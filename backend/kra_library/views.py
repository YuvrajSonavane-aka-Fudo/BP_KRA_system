"""
KRA Library Management Views
Covers:
    - KRACategory  → Create, List, Retrieve, Update, Delete, Clone
    - Level        → Create, List, Retrieve, Update, Delete, Clone
    - KRA          → Create, List, Retrieve, Update, Delete, Clone
                     (KRALevel rows are managed as nested children of KRA)

Add to urls.py:
    from django.urls import path
    from . import library_views as v

    urlpatterns += [
        # KRA Category 
        path('api/v1/kra/categories',                  v.KRACategoryListCreateView.as_view()),
        path('api/v1/kra/categories/<int:category_id>', v.KRACategoryDetailView.as_view()),
        path('api/v1/kra/categories/<int:category_id>/clone', v.KRACategoryCloneView.as_view()),

        # Level 
        path('api/v1/levels',                  v.LevelListCreateView.as_view()),
        path('api/v1/levels/<int:level_id>',   v.LevelDetailView.as_view()),
        path('api/v1/levels/<int:level_id>/clone', v.LevelCloneView.as_view()),

        # KRA (parent + its KRALevel children) 
        path('api/v1/kra/library',                 v.KRAListCreateView.as_view()),
        path('api/v1/kra/library/<int:kra_id>',    v.KRADetailView.as_view()),
        path('api/v1/kra/library/<int:kra_id>/clone', v.KRACloneView.as_view()),

        # KRALevel (standalone management per KRA) 
        path('api/v1/kra/library/<int:kra_id>/levels', v.KRALevelListCreateView.as_view()),
        path('api/v1/kra/library/<int:kra_id>/levels/<int:kra_level_id>', v.KRALevelDetailView.as_view()),
        path('api/v1/kra/library/<int:kra_id>/levels/<int:kra_level_id>/clone', v.KRALevelCloneView.as_view()),
    ]
"""

from django.shortcuts import render
import io
from django.http import HttpResponse
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from kra_cycle.models import (
    Employee,
    KRACycle,
    KRACycleStage,
    EmployeeKRACycle,
    EmployeeKRACycleCategory,
    EmployeeKRALevel,
    KRALevel,
    KRA,
    KRACategory,
    Stage,
    Level,
    Rating,
    AuditLog,
)


HR_ROLES      = {"Admin" , "HR" , "Vertical Lead"}
LEAD_ROLES    = {"Manager" , "Team Lead"}
EMPLOYEE_ROLE = "Employee"


def _get_caller(request):
    return request.user


def _is_hr(employee):
    # Check bridge table first, fall back to direct role FK
    if employee.employee_roles.filter(role__name__in=HR_ROLES).exists():
        return True
    return bool(employee.role and employee.role.name in HR_ROLES)


def _is_lead(employee):
    # Check bridge table first, fall back to direct role FK
    if employee.employee_roles.filter(role__name__in=LEAD_ROLES).exists():
        return True
    return bool(employee.role and employee.role.name in LEAD_ROLES)


def _audit(request, action, entity, entity_id, old_data=None, new_data=None):
    AuditLog.objects.create(
        employee=_get_caller(request),
        action=action,
        entity=entity,
        entity_id=entity_id,
        old_data=old_data,
        new_data=new_data,
        ip_address=request.META.get("REMOTE_ADDR"),
    )


# Serialiser helpers  (plain dicts — no DRF serialisers needed)


def _category_dict(cat):
    return {
        "id":          cat.id,
        "name":        cat.name,
        "description": cat.description,
        "is_standard": cat.is_standard,
    }


def _level_dict(lvl):
    return {
        "id":             lvl.id,
        "name":           lvl.name,
        "description":    lvl.description,
        "min_experience": lvl.min_experience,
        "max_experience": lvl.max_experience,
    }


def _kra_level_dict(kl):
    return {
        "id":          kl.id,
        "kra_id":      kl.kra_id,
        "level_id":    kl.level_id,
        "level_name":  kl.level.name if kl.level else None,
        "name":        kl.name,
        "category_id": kl.category_id,
        "category_name": kl.category.name if kl.category else None,
    }


def _kra_dict(kra, include_levels=True):
    d = {
        "id":            kra.id,
        "name":          kra.name,
        "description":   kra.description,
        "is_standard":   kra.is_standard,
        "category_id":   kra.category_id,
        "category_name": kra.category.name if kra.category else None,
    }
    if include_levels:
        d["levels"] = [
            _kra_level_dict(kl)
            for kl in kra.kra_levels.select_related("level", "category").all()
        ]
    return d



# KRA CATEGORY

class KRACategoryListCreateView(APIView):
    """
    GET  /api/v1/kra/categories              – list all categories
    POST /api/v1/kra/categories              – create a new category (HR only)

    GET query params:
        is_standard=true|false               – filter by standard flag
        search=<text>                        – partial match on name
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = KRACategory.objects.all()

        is_standard = request.query_params.get("is_standard")
        if is_standard is not None:
            qs = qs.filter(is_standard=(is_standard.lower() == "true"))

        search = request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)

        return Response(
            {"categories": [_category_dict(c) for c in qs]},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response(
                {"error": "Only HR can create categories"},
                status=status.HTTP_403_FORBIDDEN,
            )

        name = request.data.get("name", "").strip()
        if not name:
            return Response(
                {"error": "name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if KRACategory.objects.filter(name__iexact=name).exists():
            return Response(
                {"error": f"A category named '{name}' already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cat = KRACategory.objects.create(
            name=name,
            description=request.data.get("description"),
            is_standard=request.data.get("is_standard", False),
        )

        _audit(request, "CATEGORY_CREATED", "KRACategory", cat.id,
               new_data=_category_dict(cat))

        return Response(_category_dict(cat), status=status.HTTP_201_CREATED)


class KRACategoryDetailView(APIView):
    """
    GET    /api/v1/kra/categories/{category_id}  – retrieve
    PUT    /api/v1/kra/categories/{category_id}  – full update  (HR only)
    PATCH  /api/v1/kra/categories/{category_id}  – partial update (HR only)
    DELETE /api/v1/kra/categories/{category_id}  – delete (HR only)

    DELETE is blocked if any KRA or KRALevel still references this category.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, category_id):
        cat = get_object_or_404(KRACategory, id=category_id)
        return Response(_category_dict(cat), status=status.HTTP_200_OK)

    def _update(self, request, category_id, partial=False):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can update categories"},
                            status=status.HTTP_403_FORBIDDEN)

        cat      = get_object_or_404(KRACategory, id=category_id)
        old_data = _category_dict(cat)
        data     = request.data

        name = data.get("name", "").strip() if not partial else data.get("name", cat.name or "").strip()

        if not partial and not name:
            return Response({"error": "name is required"},
                            status=status.HTTP_400_BAD_REQUEST)

        # Duplicate-name check (exclude self)
        if name and KRACategory.objects.filter(
            name__iexact=name
        ).exclude(id=category_id).exists():
            return Response(
                {"error": f"A category named '{name}' already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if name:
            cat.name = name
        if "description" in data:
            cat.description = data["description"]
        if "is_standard" in data:
            cat.is_standard = data["is_standard"]

        cat.save()

        _audit(request, "CATEGORY_UPDATED", "KRACategory", cat.id,
               old_data=old_data, new_data=_category_dict(cat))

        return Response(_category_dict(cat), status=status.HTTP_200_OK)

    def put(self, request, category_id):
        return self._update(request, category_id, partial=False)

    def patch(self, request, category_id):
        return self._update(request, category_id, partial=True)

    def delete(self, request, category_id):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can delete categories"},
                            status=status.HTTP_403_FORBIDDEN)

        cat = get_object_or_404(KRACategory, id=category_id)

        # Guard: block if KRAs still use this category
        kra_count = KRA.objects.filter(category=cat).count()
        kra_level_count = KRALevel.objects.filter(category=cat).count()

        if kra_count or kra_level_count:
            return Response(
                {
                    "error": "Cannot delete category — it is still referenced by existing KRAs or KRA levels",
                    "kra_count":       kra_count,
                    "kra_level_count": kra_level_count,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        _audit(request, "CATEGORY_DELETED", "KRACategory", cat.id,
               old_data=_category_dict(cat))
        cat.delete()

        return Response(
            {"message": f"Category '{cat.name}' deleted successfully"},
            status=status.HTTP_200_OK,
        )


class KRACategoryCloneView(APIView):
    """
    POST /api/v1/kra/categories/{category_id}/clone
    Clones the category with a new name.

    Body (all optional):
        { "name": "New Name" }      – defaults to "<original> (Copy)"
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, category_id):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can clone categories"},
                            status=status.HTTP_403_FORBIDDEN)

        source   = get_object_or_404(KRACategory, id=category_id)
        new_name = request.data.get("name", f"{source.name} (Copy)").strip()

        if KRACategory.objects.filter(name__iexact=new_name).exists():
            return Response(
                {"error": f"A category named '{new_name}' already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clone = KRACategory.objects.create(
            name=new_name,
            description=source.description,
            is_standard=source.is_standard,
        )

        _audit(request, "CATEGORY_CLONED", "KRACategory", clone.id,
               new_data={"cloned_from": source.id, **_category_dict(clone)})

        return Response(
            {"cloned_from": source.id, **_category_dict(clone)},
            status=status.HTTP_201_CREATED,
        )



# LEVEL

class LevelListCreateView(APIView):
    """
    GET  /api/v1/levels   – list all levels
    POST /api/v1/levels   – create a level (HR only)

    GET query params:
        search=<text>     – partial match on name
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Level.objects.all()

        search = request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)

        return Response(
            {"levels": [_level_dict(l) for l in qs]},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can create levels"},
                            status=status.HTTP_403_FORBIDDEN)

        name = request.data.get("name", "").strip()
        if not name:
            return Response({"error": "name is required"},
                            status=status.HTTP_400_BAD_REQUEST)

        if Level.objects.filter(name__iexact=name).exists():
            return Response(
                {"error": f"A level named '{name}' already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Experience range validation
        min_exp = request.data.get("min_experience")
        max_exp = request.data.get("max_experience")

        if min_exp is not None and max_exp is not None:
            if int(min_exp) > int(max_exp):
                return Response(
                    {"error": "min_experience cannot be greater than max_experience"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        lvl = Level.objects.create(
            name=name,
            description=request.data.get("description"),
            min_experience=min_exp,
            max_experience=max_exp,
        )

        _audit(request, "LEVEL_CREATED", "Level", lvl.id,
               new_data=_level_dict(lvl))

        return Response(_level_dict(lvl), status=status.HTTP_201_CREATED)


class LevelDetailView(APIView):
    """
    GET    /api/v1/levels/{level_id}   – retrieve
    PUT    /api/v1/levels/{level_id}   – full update   (HR only)
    PATCH  /api/v1/levels/{level_id}   – partial update (HR only)
    DELETE /api/v1/levels/{level_id}   – delete (HR only)

    DELETE is blocked if employees or KRA levels still reference this level.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, level_id):
        lvl = get_object_or_404(Level, id=level_id)
        return Response(_level_dict(lvl), status=status.HTTP_200_OK)

    def _update(self, request, level_id, partial=False):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can update levels"},
                            status=status.HTTP_403_FORBIDDEN)

        lvl      = get_object_or_404(Level, id=level_id)
        old_data = _level_dict(lvl)
        data     = request.data

        name = data.get("name", lvl.name or "").strip()

        if not partial and not name:
            return Response({"error": "name is required"},
                            status=status.HTTP_400_BAD_REQUEST)

        if name and Level.objects.filter(
            name__iexact=name
        ).exclude(id=level_id).exists():
            return Response(
                {"error": f"A level named '{name}' already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        min_exp = data.get("min_experience", lvl.min_experience)
        max_exp = data.get("max_experience", lvl.max_experience)

        if min_exp is not None and max_exp is not None:
            if int(min_exp) > int(max_exp):
                return Response(
                    {"error": "min_experience cannot be greater than max_experience"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if name:
            lvl.name = name
        if "description" in data:
            lvl.description = data["description"]
        lvl.min_experience = min_exp
        lvl.max_experience = max_exp
        lvl.save()

        _audit(request, "LEVEL_UPDATED", "Level", lvl.id,
               old_data=old_data, new_data=_level_dict(lvl))

        return Response(_level_dict(lvl), status=status.HTTP_200_OK)

    def put(self, request, level_id):
        return self._update(request, level_id, partial=False)

    def patch(self, request, level_id):
        return self._update(request, level_id, partial=True)

    def delete(self, request, level_id):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can delete levels"},
                            status=status.HTTP_403_FORBIDDEN)

        lvl = get_object_or_404(Level, id=level_id)

        # Guard: employees assigned to this level
        emp_count = lvl.employees.count()          # related_name on Employee.level
        kra_level_count = lvl.kra_levels.count()   # related_name on KRALevel.level
        ekc_count = lvl.employee_kra_cycles.count() # related_name on EmployeeKRACycle.employee_level

        if emp_count or kra_level_count or ekc_count:
            return Response(
                {
                    "error": "Cannot delete level — it is still in use",
                    "employee_count":     emp_count,
                    "kra_level_count":    kra_level_count,
                    "cycle_enrol_count":  ekc_count,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        _audit(request, "LEVEL_DELETED", "Level", lvl.id,
               old_data=_level_dict(lvl))
        lvl.delete()

        return Response(
            {"message": f"Level '{lvl.name}' deleted successfully"},
            status=status.HTTP_200_OK,
        )


class LevelCloneView(APIView):
    """
    POST /api/v1/levels/{level_id}/clone
    Clones a level (does NOT copy employee assignments or KRALevel rows).

    Body (all optional):
        {
            "name":           "Dev-03",
            "min_experience": 5,
            "max_experience": 8
        }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, level_id):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can clone levels"},
                            status=status.HTTP_403_FORBIDDEN)

        source   = get_object_or_404(Level, id=level_id)
        new_name = request.data.get("name", f"{source.name} (Copy)").strip()

        if Level.objects.filter(name__iexact=new_name).exists():
            return Response(
                {"error": f"A level named '{new_name}' already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clone = Level.objects.create(
            name=new_name,
            description=source.description,
            min_experience=request.data.get("min_experience", source.min_experience),
            max_experience=request.data.get("max_experience", source.max_experience),
        )

        _audit(request, "LEVEL_CLONED", "Level", clone.id,
               new_data={"cloned_from": source.id, **_level_dict(clone)})

        return Response(
            {"cloned_from": source.id, **_level_dict(clone)},
            status=status.HTTP_201_CREATED,
        )



# KRA  (parent record)

class KRALibraryListCreateView(APIView):
    """
    GET  /api/v1/kra/library               – list all KRAs with their level variants
    POST /api/v1/kra/library               – create a KRA + its KRALevel rows (HR only)

    GET query params:
        category_id=<int>
        level_id=<int>
        is_standard=true|false
        search=<text>

    POST body:
        {
            "name":        "Own the implementation of a feature",
            "description": "...",
            "is_standard": false,
            "category_id": 1,
            "levels": [
                {
                    "level_id":    1,
                    "name":        "Dev-01 specific description",
                    "category_id": 1        ← optional, inherits from KRA if omitted
                },
                {
                    "level_id":    2,
                    "name":        "Dev-02 specific description",
                    "category_id": 1
                }
            ]
        }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = KRA.objects.select_related("category").prefetch_related(
            "kra_levels__level", "kra_levels__category"
        )

        category_id = request.query_params.get("category_id")
        level_id    = request.query_params.get("level_id")
        is_standard = request.query_params.get("is_standard")
        search      = request.query_params.get("search")

        if category_id:
            qs = qs.filter(category_id=category_id)
        if level_id:
            qs = qs.filter(kra_levels__level_id=level_id).distinct()
        if is_standard is not None:
            qs = qs.filter(is_standard=(is_standard.lower() == "true"))
        if search:
            qs = qs.filter(name__icontains=search)

        return Response(
            {"kras": [_kra_dict(k) for k in qs]},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can create KRAs"},
                            status=status.HTTP_403_FORBIDDEN)

        data = request.data
        name = (data.get("name") or "").strip()

        if not name:
            return Response({"error": "name is required"},
                            status=status.HTTP_400_BAD_REQUEST)

        category_id = data.get("category_id")
        if category_id and not KRACategory.objects.filter(id=category_id).exists():
            return Response(
                {"error": f"category_id {category_id} does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        levels_data = data.get("levels", [])

        # Validate all level_ids and category_ids in the levels list up front
        if levels_data:
            submitted_level_ids = {l.get("level_id") for l in levels_data if l.get("level_id")}
            submitted_cat_ids   = {l.get("category_id") for l in levels_data if l.get("category_id")}

            bad_levels = submitted_level_ids - set(
                Level.objects.filter(id__in=submitted_level_ids).values_list("id", flat=True)
            )
            if bad_levels:
                return Response(
                    {"error": "Invalid level_id(s) in levels list",
                     "invalid_level_ids": sorted(bad_levels)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if submitted_cat_ids:
                bad_cats = submitted_cat_ids - set(
                    KRACategory.objects.filter(id__in=submitted_cat_ids).values_list("id", flat=True)
                )
                if bad_cats:
                    return Response(
                        {"error": "Invalid category_id(s) in levels list",
                         "invalid_category_ids": sorted(bad_cats)},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        with transaction.atomic():
            kra = KRA.objects.create(
                name=name,
                description=data.get("description"),
                is_standard=data.get("is_standard", True),
                category_id=category_id,
            )

            for l in levels_data:
                KRALevel.objects.create(
                    kra=kra,
                    level_id=l.get("level_id"),
                    name=l.get("name", name),       # inherit KRA name if not given
                    category_id=l.get("category_id") or category_id,
                )

        _audit(request, "KRA_CREATED", "KRA", kra.id,
               new_data={**_kra_dict(kra), "levels_created": len(levels_data)})

        # Re-fetch with prefetch to return complete response
        kra.refresh_from_db()
        return Response(_kra_dict(kra), status=status.HTTP_201_CREATED)


class KRADetailView(APIView):
    """
    GET    /api/v1/kra/library/{kra_id}   – retrieve KRA + all its level variants
    PUT    /api/v1/kra/library/{kra_id}   – full update (HR only)
    PATCH  /api/v1/kra/library/{kra_id}   – partial update (HR only)
    DELETE /api/v1/kra/library/{kra_id}   – delete KRA + all KRALevel rows (HR only)

    PUT/PATCH only updates the KRA parent fields (name, description, category, is_standard).
    To manage individual KRALevel rows use the /levels sub-endpoints.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, kra_id):
        kra = get_object_or_404(
            KRA.objects.select_related("category").prefetch_related(
                "kra_levels__level", "kra_levels__category"
            ),
            id=kra_id,
        )
        return Response(_kra_dict(kra), status=status.HTTP_200_OK)
    def put(self, request, kra_id):
        return self._update(request, kra_id, partial=False)

    def patch(self, request, kra_id):
        return self._update(request, kra_id, partial=True)

    # def _update(self, request, kra_id, partial=False):
    #     caller = _get_caller(request)
    #     if not _is_hr(caller):
    #         return Response({"error": "Only HR can update KRAs"},
    #                         status=status.HTTP_403_FORBIDDEN)

    #     kra      = get_object_or_404(KRA, id=kra_id)
    #     old_data = _kra_dict(kra, include_levels=False)
    #     data     = request.data

    #     name = data.get("name", kra.name or "").strip()
    #     if not partial and not name:
    #         return Response({"error": "name is required"},
    #                         status=status.HTTP_400_BAD_REQUEST)

    #     if "category_id" in data and data["category_id"]:
    #         if not KRACategory.objects.filter(id=data["category_id"]).exists():
    #             return Response(
    #                 {"error": f"category_id {data['category_id']} does not exist"},
    #                 status=status.HTTP_400_BAD_REQUEST,
    #             )
    #         kra.category_id = data["category_id"]

    #     if name:
    #         kra.name = name
    #     if "description" in data:
    #         kra.description = data["description"]
    #     if "is_standard" in data:
    #         kra.is_standard = data["is_standard"]

    #     kra.save()

    #     _audit(request, "KRA_UPDATED", "KRA", kra.id,
    #            old_data=old_data, new_data=_kra_dict(kra, include_levels=False))

    #     return Response(_kra_dict(kra), status=status.HTTP_200_OK)

    # def put(self, request, kra_id):
    #     return self._update(request, kra_id, partial=False)

    # def patch(self, request, kra_id):
    #     return self._update(request, kra_id, partial=True)

    def delete(self, request, kra_id):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can delete KRAs"},
                            status=status.HTTP_403_FORBIDDEN)

        kra = get_object_or_404(KRA, id=kra_id)

        # Guard: KRALevel rows that are actively assigned to employees
        active_assignments = kra.kra_levels.filter(
            employee_kra_levels__isnull=False   # related_name on EmployeeKRALevel.kra_level
        ).distinct().count()

        if active_assignments:
            return Response(
                {
                    "error": "Cannot delete KRA — its level variants are assigned to employees in active cycles",
                    "assigned_kra_level_count": active_assignments,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        _audit(request, "KRA_DELETED", "KRA", kra.id,
               old_data=_kra_dict(kra))

        with transaction.atomic():
            kra.kra_levels.all().delete()   # cascade via related_name
            kra.delete()

        return Response(
            {"message": f"KRA and all its level variants deleted successfully"},
            status=status.HTTP_200_OK,
        )
        
    def _update(self, request, kra_id, partial=False):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can update KRAs"},
                            status=status.HTTP_403_FORBIDDEN)

        kra      = get_object_or_404(KRA, id=kra_id)
        old_data = _kra_dict(kra)
        data     = request.data

        #  Parent KRA fields 
        name = data.get("name", kra.name or "").strip()
        if not partial and not name:
            return Response({"error": "name is required"},
                            status=status.HTTP_400_BAD_REQUEST)

        if "category_id" in data and data["category_id"]:
            if not KRACategory.objects.filter(id=data["category_id"]).exists():
                return Response(
                    {"error": f"category_id {data['category_id']} does not exist"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            kra.category_id = data["category_id"]

        if name:
            kra.name = name
        if "description" in data:
            kra.description = data["description"]
        if "is_standard" in data:
            kra.is_standard = data["is_standard"]

        # Levels (optional in both PUT and PATCH) 
        levels_data = data.get("levels")   # None means "not provided — don't touch"

        if levels_data is not None:

            # Validate all level_ids and category_ids before touching the DB
            submitted_level_ids = {l.get("level_id") for l in levels_data if l.get("level_id")}
            submitted_cat_ids   = {l.get("category_id") for l in levels_data if l.get("category_id")}

            if submitted_level_ids:
                bad_levels = submitted_level_ids - set(
                    Level.objects.filter(id__in=submitted_level_ids).values_list("id", flat=True)
                )
                if bad_levels:
                    return Response(
                        {"error": "Invalid level_id(s) in levels",
                        "invalid_level_ids": sorted(bad_levels)},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            if submitted_cat_ids:
                bad_cats = submitted_cat_ids - set(
                    KRACategory.objects.filter(id__in=submitted_cat_ids).values_list("id", flat=True)
                )
                if bad_cats:
                    return Response(
                        {"error": "Invalid category_id(s) in levels",
                        "invalid_category_ids": sorted(bad_cats)},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Check none of the levels being removed are assigned to employees
            incoming_level_ids = {l.get("level_id") for l in levels_data if l.get("level_id")}
            levels_being_removed = kra.kra_levels.exclude(level_id__in=incoming_level_ids)
            actively_assigned = levels_being_removed.filter(
                employee_kra_levels__isnull=False
            ).distinct()

            if actively_assigned.exists():
                return Response(
                    {
                        "error": "Cannot remove level variants that are already assigned to employees",
                        "blocked_level_ids": list(
                            actively_assigned.values_list("level_id", flat=True)
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            with transaction.atomic():
                kra.save()

                # Delete levels not in the incoming list
                levels_being_removed.delete()

                # Upsert each incoming level
                for l in levels_data:
                    level_id    = l.get("level_id")
                    level_name  = l.get("name", kra.name)
                    category_id = l.get("category_id") or kra.category_id

                    KRALevel.objects.update_or_create(
                        kra=kra,
                        level_id=level_id,
                        defaults={
                            "name":        level_name,
                            "category_id": category_id,
                        },
                    )
        else:
            kra.save()

        _audit(request, "KRA_UPDATED", "KRA", kra.id,
            old_data=old_data, new_data=_kra_dict(kra))

        kra.refresh_from_db()
        return Response(_kra_dict(kra), status=status.HTTP_200_OK)


class KRACloneView(APIView):
    """
    POST /api/v1/kra/library/{kra_id}/clone
    Deep-clones a KRA: creates a new KRA row AND clones all its KRALevel rows.

    Body (all optional):
        {
            "name":        "Cloned KRA name",       ← defaults to "<original> (Copy)"
            "category_id": 2                         ← override category if needed
        }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, kra_id):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can clone KRAs"},
                            status=status.HTTP_403_FORBIDDEN)

        source   = get_object_or_404(KRA, id=kra_id)
        new_name = request.data.get("name", f"{source.name} (Copy)").strip()
        new_cat  = request.data.get("category_id", source.category_id)

        if new_cat and not KRACategory.objects.filter(id=new_cat).exists():
            return Response(
                {"error": f"category_id {new_cat} does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        source_levels = list(source.kra_levels.select_related("level", "category").all())

        with transaction.atomic():
            clone = KRA.objects.create(
                name=new_name,
                description=source.description,
                is_standard=source.is_standard,
                category_id=new_cat,
            )

            KRALevel.objects.bulk_create([
                KRALevel(
                    kra=clone,
                    level_id=kl.level_id,
                    name=kl.name,
                    category_id=kl.category_id,
                )
                for kl in source_levels
            ])

        _audit(request, "KRA_CLONED", "KRA", clone.id,
               new_data={
                   "cloned_from":   source.id,
                   "levels_cloned": len(source_levels),
                   **_kra_dict(clone, include_levels=False),
               })

        clone.refresh_from_db()
        return Response(
            {"cloned_from": source.id, **_kra_dict(clone)},
            status=status.HTTP_201_CREATED,
        )



# KRA LEVEL  (child of KRA — the level-specific variant)


class KRALevelListCreateView(APIView):
    """
    GET  /api/v1/kra/library/{kra_id}/levels       – list all variants for a KRA
    POST /api/v1/kra/library/{kra_id}/levels       – add a new level variant (HR only)

    POST body:
        {
            "level_id":    2,
            "name":        "Dev-02 specific description",
            "category_id": 1       ← optional, inherits from KRA if omitted
        }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, kra_id):
        kra = get_object_or_404(KRA, id=kra_id)
        levels = kra.kra_levels.select_related("level", "category").all()
        return Response(
            {"kra_id": kra_id, "levels": [_kra_level_dict(kl) for kl in levels]},
            status=status.HTTP_200_OK,
        )

    def post(self, request, kra_id):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can add KRA level variants"},
                            status=status.HTTP_403_FORBIDDEN)

        kra      = get_object_or_404(KRA, id=kra_id)
        data     = request.data
        level_id = data.get("level_id")

        if not level_id:
            return Response({"error": "level_id is required"},
                            status=status.HTTP_400_BAD_REQUEST)

        if not Level.objects.filter(id=level_id).exists():
            return Response(
                {"error": f"level_id {level_id} does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Prevent duplicate level variant for the same KRA
        if KRALevel.objects.filter(kra=kra, level_id=level_id).exists():
            return Response(
                {"error": f"A variant for level_id {level_id} already exists on this KRA"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        category_id = data.get("category_id") or kra.category_id
        if category_id and not KRACategory.objects.filter(id=category_id).exists():
            return Response(
                {"error": f"category_id {category_id} does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        kl = KRALevel.objects.create(
            kra=kra,
            level_id=level_id,
            name=data.get("name", kra.name),
            category_id=category_id,
        )

        _audit(request, "KRA_LEVEL_CREATED", "KRALevel", kl.id,
               new_data=_kra_level_dict(kl))

        return Response(_kra_level_dict(kl), status=status.HTTP_201_CREATED)


class KRALevelDetailView(APIView):
    """
    GET    /api/v1/kra/library/{kra_id}/levels/{kra_level_id}  – retrieve
    PUT    /api/v1/kra/library/{kra_id}/levels/{kra_level_id}  – full update   (HR only)
    PATCH  /api/v1/kra/library/{kra_id}/levels/{kra_level_id}  – partial update (HR only)
    DELETE /api/v1/kra/library/{kra_id}/levels/{kra_level_id}  – delete (HR only)

    DELETE is blocked if the KRALevel is currently assigned to any employee.
    """
    permission_classes = [IsAuthenticated]

    def _get_kra_level(self, kra_id, kra_level_id):
        return get_object_or_404(
            KRALevel.objects.select_related("level", "category"),
            id=kra_level_id, kra_id=kra_id,
        )

    def get(self, request, kra_id, kra_level_id):
        kl = self._get_kra_level(kra_id, kra_level_id)
        return Response(_kra_level_dict(kl), status=status.HTTP_200_OK)

    def _update(self, request, kra_id, kra_level_id, partial=False):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can update KRA level variants"},
                            status=status.HTTP_403_FORBIDDEN)

        kl       = self._get_kra_level(kra_id, kra_level_id)
        old_data = _kra_level_dict(kl)
        data     = request.data

        new_level_id = data.get("level_id")
        if new_level_id and new_level_id != kl.level_id:
            if not Level.objects.filter(id=new_level_id).exists():
                return Response(
                    {"error": f"level_id {new_level_id} does not exist"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if KRALevel.objects.filter(
                kra_id=kra_id, level_id=new_level_id
            ).exclude(id=kra_level_id).exists():
                return Response(
                    {"error": f"A variant for level_id {new_level_id} already exists on this KRA"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            kl.level_id = new_level_id

        if "name" in data:
            kl.name = data["name"]

        if "category_id" in data and data["category_id"]:
            if not KRACategory.objects.filter(id=data["category_id"]).exists():
                return Response(
                    {"error": f"category_id {data['category_id']} does not exist"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            kl.category_id = data["category_id"]

        kl.save()

        _audit(request, "KRA_LEVEL_UPDATED", "KRALevel", kl.id,
               old_data=old_data, new_data=_kra_level_dict(kl))

        return Response(_kra_level_dict(kl), status=status.HTTP_200_OK)

    def put(self, request, kra_id, kra_level_id):
        return self._update(request, kra_id, kra_level_id, partial=False)

    def patch(self, request, kra_id, kra_level_id):
        return self._update(request, kra_id, kra_level_id, partial=True)

    def delete(self, request, kra_id, kra_level_id):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can delete KRA level variants"},
                            status=status.HTTP_403_FORBIDDEN)

        kl = self._get_kra_level(kra_id, kra_level_id)

        assigned_count = kl.employee_kra_levels.count()   # related_name on EmployeeKRALevel.kra_level
        if assigned_count:
            return Response(
                {
                    "error": "Cannot delete — this KRA level variant is assigned to employees",
                    "assigned_employee_count": assigned_count,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        _audit(request, "KRA_LEVEL_DELETED", "KRALevel", kl.id,
               old_data=_kra_level_dict(kl))
        kl.delete()

        return Response(
            {"message": "KRA level variant deleted successfully"},
            status=status.HTTP_200_OK,
        )


class KRALevelCloneView(APIView):
    """
    POST /api/v1/kra/library/{kra_id}/levels/{kra_level_id}/clone

    Two sub-modes:

    1. Clone within the same KRA onto a different level:
        { "level_id": 3 }

    2. Clone onto a completely different KRA (and optionally a different level):
        { "target_kra_id": 15, "level_id": 2 }

    Body:
        {
            "level_id":     <int>,          required
            "target_kra_id": <int>,         optional — defaults to same KRA
            "name":         "...",          optional — defaults to source name
            "category_id":  <int>           optional — defaults to source category
        }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, kra_id, kra_level_id):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can clone KRA level variants"},
                            status=status.HTTP_403_FORBIDDEN)

        source = get_object_or_404(KRALevel, id=kra_level_id, kra_id=kra_id)
        data   = request.data

        new_level_id  = data.get("level_id")
        target_kra_id = data.get("target_kra_id", kra_id)

        if not new_level_id:
            return Response(
                {"error": "level_id is required — specify which level this clone targets"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not Level.objects.filter(id=new_level_id).exists():
            return Response(
                {"error": f"level_id {new_level_id} does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_kra = get_object_or_404(KRA, id=target_kra_id)

        if KRALevel.objects.filter(kra=target_kra, level_id=new_level_id).exists():
            return Response(
                {
                    "error": (
                        f"A variant for level_id {new_level_id} already exists "
                        f"on KRA {target_kra_id}"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        category_id = data.get("category_id", source.category_id)
        if category_id and not KRACategory.objects.filter(id=category_id).exists():
            return Response(
                {"error": f"category_id {category_id} does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clone = KRALevel.objects.create(
            kra=target_kra,
            level_id=new_level_id,
            name=data.get("name", source.name),
            category_id=category_id,
        )

        _audit(request, "KRA_LEVEL_CLONED", "KRALevel", clone.id,
               new_data={
                   "cloned_from_kra_level_id": source.id,
                   "source_kra_id":  kra_id,
                   "target_kra_id":  target_kra_id,
                   **_kra_level_dict(clone),
               })

        return Response(
            {
                "cloned_from": source.id,
                "source_kra_id": kra_id,
                "target_kra_id": target_kra_id,
                **_kra_level_dict(clone),
            },
            status=status.HTTP_201_CREATED,
        )
