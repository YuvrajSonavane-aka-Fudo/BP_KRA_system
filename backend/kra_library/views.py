"""
File: views.py
App: kra_library
Purpose:
    Handles the HTTP request/response lifecycle for API endpoints.

Includes:
    - Category views
    - Level views
    - KRA views
    - KRALevel views
    - Audit log

Responsibilities:
    - Handle the HTTP request/response lifecycle for API endpoints.

Notes:
    - Keep views thin
    - No direct DB-heavy logic
    - Identity source is now Employee (hrflow_employee), not User (hrflow_users).

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
from rest_framework.request import Request
from django.db import transaction
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
from .serializers import (
    KRACategorySerializer,
    LevelSerializer,
    KRALevelSerializer,
    KRASerializer,
)
from utils import _get_caller, _is_hr, _is_lead, _audit


# KRA CATEGORY

class KRACategoryListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """
        API view to list all categories.

        Endpoint: GET /api/v1/kra/categories

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "categories": [
                    {
                        "id": 1,
                        "name": "Core Development",
                        "description": "...",
                        "is_standard": true
                    }
                ]
            }

        Error Responses:
            401: Unauthorized
        """
        queryset = KRACategory.objects.all()

        is_standard = request.query_params.get("is_standard")
        if is_standard is not None:
            queryset = queryset.filter(is_standard=(is_standard.lower() == "true"))

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)

        return Response(
            {"categories": KRACategorySerializer(queryset, many=True).data},
            status=status.HTTP_200_OK,
        )

    def post(self, request: Request) -> Response:
        """
        API view to create a new category.

        Endpoint: POST /api/v1/kra/categories

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<category_name>",
                "description": "<category_description>",
                "is_standard": false
            }

        Response (201):
            {
                "id": 1,
                "name": "<category_name>",
                "description": "<category_description>",
                "is_standard": false
            }

        Error Responses:
            400: Invalid request data or duplicate name
            403: Only HR can create categories
            401: Unauthorized
        """
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

        category = KRACategory.objects.create(
            name=name,
            description=request.data.get("description"),
            is_standard=request.data.get("is_standard", False),
        )

        _audit(request, "CATEGORY_CREATED", "KRACategory", category.id,
               new_data=KRACategorySerializer(category).data)

        return Response(KRACategorySerializer(category).data, status=status.HTTP_201_CREATED)


class KRACategoryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, category_id: int) -> Response:
        """
        API view to retrieve a category by ID.

        Endpoint: GET /api/v1/kra/categories/<category_id>

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "id": 1,
                "name": "<category_name>",
                "description": "<category_description>",
                "is_standard": false
            }

        Error Responses:
            404: Category not found
            401: Unauthorized
        """
        category = get_object_or_404(KRACategory, id=category_id)
        return Response(KRACategorySerializer(category).data, status=status.HTTP_200_OK)

    def _update(self, request: Request, category_id: int, partial: bool = False) -> Response:
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can update categories"},
                            status=status.HTTP_403_FORBIDDEN)

        category = get_object_or_404(KRACategory, id=category_id)
        old_data = KRACategorySerializer(category).data
        data     = request.data

        name = data.get("name", "").strip() if not partial else data.get("name", category.name or "").strip()

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
            category.name = name
        if "description" in data:
            category.description = data["description"]
        if "is_standard" in data:
            category.is_standard = data["is_standard"]

        category.save()

        _audit(request, "CATEGORY_UPDATED", "KRACategory", category.id,
               old_data=old_data, new_data=KRACategorySerializer(category).data)

        return Response(KRACategorySerializer(category).data, status=status.HTTP_200_OK)

    def put(self, request: Request, category_id: int) -> Response:
        """
        API view to fully update a category.

        Endpoint: PUT /api/v1/kra/categories/<category_id>

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<category_name>",
                "description": "<category_description>",
                "is_standard": false
            }

        Response (200):
            {
                "id": 1,
                "name": "<category_name>",
                "description": "<category_description>",
                "is_standard": false
            }

        Error Responses:
            400: Name is required or duplicate name exists
            403: Only HR can update categories
            404: Category not found
            401: Unauthorized
        """
        return self._update(request, category_id, partial=False)

    def patch(self, request: Request, category_id: int) -> Response:
        """
        API view to partially update a category.

        Endpoint: PATCH /api/v1/kra/categories/<category_id>

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<category_name>",
                "description": "<category_description>",
                "is_standard": false
            }

        Response (200):
            {
                "id": 1,
                "name": "<category_name>",
                "description": "<category_description>",
                "is_standard": false
            }

        Error Responses:
            400: Duplicate name exists
            403: Only HR can update categories
            404: Category not found
            401: Unauthorized
        """
        return self._update(request, category_id, partial=True)

    def delete(self, request: Request, category_id: int) -> Response:
        """
        API view to delete a category.

        Endpoint: DELETE /api/v1/kra/categories/<category_id>

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "message": "Category '<category_name>' and all related KRAs deleted successfully"
            }

        Error Responses:
            403: Only HR can delete categories
            409: Cannot delete - category contains KRAs assigned to employees
            404: Category not found
            401: Unauthorized
        """
        caller = _get_caller(request)

        if not _is_hr(caller):
            return Response(
                {"error": "Only HR can delete categories"},
                status=status.HTTP_403_FORBIDDEN,
            )

        category = get_object_or_404(KRACategory, id=category_id)

        # Block deletion if any KRALevel under this category's KRAs
        # (or directly tagged to this category) is assigned to an employee.
        from django.db import connection
        with connection.cursor() as cursor:
            # count assigned kra_levels under this category
            cursor.execute("""
                SELECT COUNT(DISTINCT ekl.kra_level_id)
                FROM employee_kra_level ekl
                INNER JOIN kra_level kl ON ekl.kra_level_id = kl.id
                INNER JOIN kra k ON kl.kra_id = k.id
                WHERE k.category_id = %s
            """, [category.id])
            assigned_kra_level_count = cursor.fetchone()[0] or 0

            # count assigned kras under this category
            cursor.execute("""
                SELECT COUNT(DISTINCT kl.kra_id)
                FROM employee_kra_level ekl
                INNER JOIN kra_level kl ON ekl.kra_level_id = kl.id
                INNER JOIN kra k ON kl.kra_id = k.id
                WHERE k.category_id = %s
            """, [category.id])
            assigned_kra_count = cursor.fetchone()[0] or 0


        if assigned_kra_level_count:
            return Response(
                {
                    "error": (
                        "Cannot delete — this category contains KRAs that are "
                        "already assigned to employees"
                    ),
                    "assigned_kra_count":       assigned_kra_count,
                    "assigned_kra_level_count": assigned_kra_level_count,
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                kras       = KRA.objects.filter(category=category)
                kra_levels = KRALevel.objects.filter(kra__in=kras)
                kra_levels.delete()
                kras.delete()

                category_name = category.name
                _audit(
                    request,
                    "CATEGORY_DELETED",
                    "KRACategory",
                    category.id,
                    old_data=KRACategorySerializer(category).data,
                )
                category.delete()

            return Response(
                {
                    "message": (
                        f"Category '{category_name}' and all related "
                        f"KRAs deleted successfully"
                    )
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        


class KRACategoryCloneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, category_id: int) -> Response:
        """
        API view to clone a category.

        Endpoint: POST /api/v1/kra/categories/<category_id>/clone

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<new_cloned_name>"
            }

        Response (201):
            {
                "cloned_from": 1,
                "id": 2,
                "name": "<new_cloned_name>",
                "description": "<source_description>",
                "is_standard": false
            }

        Error Responses:
            400: Duplicate name exists
            403: Only HR can clone categories
            404: Category not found
            401: Unauthorized
        """
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
               new_data={"cloned_from": source.id, **KRACategorySerializer(clone).data})

        return Response(
            {"cloned_from": source.id, **KRACategorySerializer(clone).data},
            status=status.HTTP_201_CREATED,
        )



# LEVEL

class LevelListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """
        API view to list all levels.

        Endpoint: GET /api/v1/levels

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "levels": [
                    {
                        "id": 1,
                        "name": "Dev-01",
                        "description": "...",
                        "min_experience": 0,
                        "max_experience": 2
                    }
                ]
            }

        Error Responses:
            401: Unauthorized
        """
        queryset = Level.objects.all()

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)

        return Response(
            {"levels": LevelSerializer(queryset, many=True).data},
            status=status.HTTP_200_OK,
        )

    def post(self, request: Request) -> Response:
        """
        API view to create a level.

        Endpoint: POST /api/v1/levels

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<level_name>",
                "description": "<level_description>",
                "min_experience": 0,
                "max_experience": 2
            }

        Response (201):
            {
                "id": 1,
                "name": "<level_name>",
                "description": "<level_description>",
                "min_experience": 0,
                "max_experience": 2
            }

        Error Responses:
            400: Name is required, duplicate level name, or invalid experience range
            403: Only HR can create levels
            401: Unauthorized
        """
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

        level = Level.objects.create(
            name=name,
            description=request.data.get("description"),
            min_experience=min_exp,
            max_experience=max_exp,
        )

        _audit(request, "LEVEL_CREATED", "Level", level.id,
               new_data=LevelSerializer(level).data)

        return Response(LevelSerializer(level).data, status=status.HTTP_201_CREATED)


class LevelDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, level_id: int) -> Response:
        """
        API view to retrieve a level.

        Endpoint: GET /api/v1/levels/<level_id>

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "id": 1,
                "name": "<level_name>",
                "description": "<level_description>",
                "min_experience": 0,
                "max_experience": 2
            }

        Error Responses:
            404: Level not found
            401: Unauthorized
        """
        level = get_object_or_404(Level, id=level_id)
        return Response(LevelSerializer(level).data, status=status.HTTP_200_OK)

    def _update(self, request: Request, level_id: int, partial: bool = False) -> Response:
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can update levels"},
                            status=status.HTTP_403_FORBIDDEN)

        level    = get_object_or_404(Level, id=level_id)
        old_data = LevelSerializer(level).data
        data     = request.data

        name = data.get("name", level.name or "").strip()

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

        min_exp = data.get("min_experience", level.min_experience)
        max_exp = data.get("max_experience", level.max_experience)

        if min_exp is not None and max_exp is not None:
            if int(min_exp) > int(max_exp):
                return Response(
                    {"error": "min_experience cannot be greater than max_experience"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if name:
            level.name = name
        if "description" in data:
            level.description = data["description"]
        level.min_experience = min_exp
        level.max_experience = max_exp
        level.save()

        _audit(request, "LEVEL_UPDATED", "Level", level.id,
               old_data=old_data, new_data=LevelSerializer(level).data)

        return Response(LevelSerializer(level).data, status=status.HTTP_200_OK)

    def put(self, request: Request, level_id: int) -> Response:
        """
        API view to fully update a level.

        Endpoint: PUT /api/v1/levels/<level_id>

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<level_name>",
                "description": "<level_description>",
                "min_experience": 0,
                "max_experience": 2
            }

        Response (200):
            {
                "id": 1,
                "name": "<level_name>",
                "description": "<level_description>",
                "min_experience": 0,
                "max_experience": 2
            }

        Error Responses:
            400: Name is required, duplicate name, or invalid experience range
            403: Only HR can update levels
            404: Level not found
            401: Unauthorized
        """
        return self._update(request, level_id, partial=False)

    def patch(self, request: Request, level_id: int) -> Response:
        """
        API view to partially update a level.

        Endpoint: PATCH /api/v1/levels/<level_id>

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<level_name>",
                "description": "<level_description>",
                "min_experience": 0,
                "max_experience": 2
            }

        Response (200):
            {
                "id": 1,
                "name": "<level_name>",
                "description": "<level_description>",
                "min_experience": 0,
                "max_experience": 2
            }

        Error Responses:
            400: Duplicate name or invalid experience range
            403: Only HR can update levels
            404: Level not found
            401: Unauthorized
        """
        return self._update(request, level_id, partial=True)

    def delete(self, request: Request, level_id: int) -> Response:
        """
        API view to delete a level.

        Endpoint: DELETE /api/v1/levels/<level_id>

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "message": "Level '<level_name>' deleted successfully"
            }

        Error Responses:
            400: Cannot delete level - it is still in use
            403: Only HR can delete levels
            404: Level not found
            401: Unauthorized
        """
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can delete levels"},
                            status=status.HTTP_403_FORBIDDEN)

        level = get_object_or_404(Level, id=level_id)

        # Guard: employees assigned to this level
        emp_count = level.employees.count()          # related_name on Employee.level
        kra_level_count = level.kra_levels.count()   # related_name on KRALevel.level
        ekc_count = level.employee_kra_cycles.count() # related_name on EmployeeKRACycle.employee_level

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

        _audit(request, "LEVEL_DELETED", "Level", level.id,
               old_data=LevelSerializer(level).data)
        level.delete()

        return Response(
            {"message": f"Level '{level.name}' deleted successfully"},
            status=status.HTTP_200_OK,
        )


class LevelCloneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, level_id: int) -> Response:
        """
        API view to clone a level.

        Endpoint: POST /api/v1/levels/<level_id>/clone

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<new_cloned_name>",
                "min_experience": 0,
                "max_experience": 2
            }

        Response (201):
            {
                "cloned_from": 1,
                "id": 2,
                "name": "<new_cloned_name>",
                "description": "<source_description>",
                "min_experience": 0,
                "max_experience": 2
            }

        Error Responses:
            400: Duplicate name exists
            403: Only HR can clone levels
            404: Level not found
            401: Unauthorized
        """
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
               new_data={"cloned_from": source.id, **LevelSerializer(clone).data})

        return Response(
            {"cloned_from": source.id, **LevelSerializer(clone).data},
            status=status.HTTP_201_CREATED,
        )



# KRA  (parent record)

class KRALibraryListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """
        API view to list all KRAs with level variants.

        Endpoint: GET /api/v1/kra/library_kra

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "kras": [
                    {
                        "id": 1,
                        "name": "KRA name",
                        "description": "...",
                        "is_standard": true,
                        "category_id": 1,
                        "category_name": "...",
                        "levels": [
                            {
                                "id": 1,
                                "kra_id": 1,
                                "level_id": 1,
                                "level_name": "Dev-01",
                                "name": "Dev-01 specific desc",
                                "category_id": 1,
                                "category_name": "..."
                            }
                        ]
                    }
                ]
            }

        Error Responses:
            401: Unauthorized
        """
        sql = """
            SELECT DISTINCT k.id, k.name, k.description, k.is_standard, k.category_id,
                   c.name AS cat_name, c.description AS cat_desc, c.is_standard AS cat_std
            FROM kra k
            LEFT JOIN kra_category c ON k.category_id = c.id
        """
        params = []
        conditions = []

        category_id = request.query_params.get("category_id")
        level_id    = request.query_params.get("level_id")
        is_standard = request.query_params.get("is_standard")
        search      = request.query_params.get("search")

        if level_id:
            sql += " INNER JOIN kra_level kl ON k.id = kl.kra_id"
            conditions.append("kl.level_id = %s")
            params.append(int(level_id))

        if category_id:
            conditions.append("k.category_id = %s")
            params.append(int(category_id))

        if is_standard is not None:
            conditions.append("k.is_standard = %s")
            params.append(is_standard.lower() == "true")

        if search:
            conditions.append("LOWER(k.name) LIKE LOWER(%s)")
            params.append(f"%{search}%")

        if conditions:
            sql += " WHERE " + " AND ".join(conditions)

        raw_qs = KRA.objects.raw(sql, params)

        kras = []
        for k in raw_qs:
            if k.category_id:
                k.category = KRACategory(
                    id=k.category_id,
                    name=getattr(k, 'cat_name', None),
                    description=getattr(k, 'cat_desc', None),
                    is_standard=getattr(k, 'cat_std', False)
                )
            else:
                k.category = None
            kras.append(k)

        from django.db.models import prefetch_related_objects
        prefetch_related_objects(kras, "kra_levels__level", "kra_levels__category")

        return Response(
            {"kras": KRASerializer(kras, many=True).data},
            status=status.HTTP_200_OK,
        )


    def post(self, request: Request) -> Response:
        """
        API view to create a KRA and its level variants.

        Endpoint: POST /api/v1/kra/library_kra

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<kra_name>",
                "description": "<description>",
                "is_standard": true,
                "category_id": 1,
                "levels": [
                    {
                        "level_id": 1,
                        "name": "Level-specific name",
                        "category_id": 1
                    }
                ]
            }

        Response (201):
            {
                "id": 1,
                "name": "<kra_name>",
                "description": "<description>",
                "is_standard": true,
                "category_id": 1,
                "category_name": "...",
                "levels": [
                    {
                        "id": 1,
                        "kra_id": 1,
                        "level_id": 1,
                        "level_name": "Dev-01",
                        "name": "Level-specific name",
                        "category_id": 1,
                        "category_name": "..."
                    }
                ]
            }

        Error Responses:
            400: Name is required, category_id does not exist, or invalid level_id/category_id in level variants
            403: Only HR can create KRAs
            401: Unauthorized
        """
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
            submitted_level_ids = {level_item.get("level_id") for level_item in levels_data if level_item.get("level_id")}
            submitted_cat_ids   = {level_item.get("category_id") for level_item in levels_data if level_item.get("category_id")}

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

            for level_item in levels_data:
                KRALevel.objects.create(
                    kra=kra,
                    level_id=level_item.get("level_id"),
                    name=level_item.get("name", name),       # inherit KRA name if not given
                    category_id=level_item.get("category_id") or category_id,
                )

        kra.refresh_from_db()
        _audit(request, "KRA_CREATED", "KRA", kra.id,
               new_data={**KRASerializer(kra).data, "levels_created": len(levels_data)})

        return Response(KRASerializer(kra).data, status=status.HTTP_201_CREATED)


class KRADetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, kra_id: int) -> Response:
        """
        API view to retrieve a KRA with level variants.

        Endpoint: GET /api/v1/kra/library_kra/<kra_id>

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "id": 1,
                "name": "<kra_name>",
                "description": "<description>",
                "is_standard": true,
                "category_id": 1,
                "category_name": "...",
                "levels": [
                    {
                        "id": 1,
                        "kra_id": 1,
                        "level_id": 1,
                        "level_name": "Dev-01",
                        "name": "Level-specific name",
                        "category_id": 1,
                        "category_name": "..."
                    }
                ]
            }

        Error Responses:
            404: KRA not found
            401: Unauthorized
        """
        sql = """
            SELECT k.id, k.name, k.description, k.is_standard, k.category_id,
                   c.name AS cat_name, c.description AS cat_desc, c.is_standard AS cat_std
            FROM kra k
            LEFT JOIN kra_category c ON k.category_id = c.id
            WHERE k.id = %s
        """
        raw_qs = KRA.objects.raw(sql, [kra_id])
        kras = list(raw_qs)
        if not kras:
            from django.http import Http404
            raise Http404("No KRA matches the given query.")

        kra = kras[0]
        if kra.category_id:
            kra.category = KRACategory(
                id=kra.category_id,
                name=getattr(kra, 'cat_name', None),
                description=getattr(kra, 'cat_desc', None),
                is_standard=getattr(kra, 'cat_std', False)
            )
        else:
            kra.category = None

        from django.db.models import prefetch_related_objects
        prefetch_related_objects([kra], "kra_levels__level", "kra_levels__category")

        return Response(KRASerializer(kra).data, status=status.HTTP_200_OK)


    def put(self, request: Request, kra_id: int) -> Response:
        """
        API view to fully update a KRA and its level variants.

        Endpoint: PUT /api/v1/kra/library_kra/<kra_id>

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<kra_name>",
                "description": "<description>",
                "is_standard": true,
                "category_id": 1,
                "levels": [
                    {
                        "level_id": 1,
                        "name": "Level-specific name",
                        "category_id": 1
                    }
                ]
            }

        Response (200):
            {
                "id": 1,
                "name": "<kra_name>",
                "description": "<description>",
                "is_standard": true,
                "category_id": 1,
                "category_name": "...",
                "levels": [
                    {
                        "id": 1,
                        "kra_id": 1,
                        "level_id": 1,
                        "level_name": "Dev-01",
                        "name": "Level-specific name",
                        "category_id": 1,
                        "category_name": "..."
                    }
                ]
            }

        Error Responses:
            400: Name is required, category_id does not exist, invalid level/category in variants, or active variant removal block
            403: Only HR can update KRAs
            404: KRA not found
            401: Unauthorized
        """
        return self._update(request, kra_id, partial=False)

    def patch(self, request: Request, kra_id: int) -> Response:
        """
        API view to partially update a KRA and its level variants.

        Endpoint: PATCH /api/v1/kra/library_kra/<kra_id>

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<kra_name>",
                "description": "<description>",
                "is_standard": true,
                "category_id": 1,
                "levels": [
                    {
                        "level_id": 1,
                        "name": "Level-specific name",
                        "category_id": 1
                    }
                ]
            }

        Response (200):
            {
                "id": 1,
                "name": "<kra_name>",
                "description": "<description>",
                "is_standard": true,
                "category_id": 1,
                "category_name": "...",
                "levels": [
                    {
                        "id": 1,
                        "kra_id": 1,
                        "level_id": 1,
                        "level_name": "Dev-01",
                        "name": "Level-specific name",
                        "category_id": 1,
                        "category_name": "..."
                    }
                ]
            }

        Error Responses:
            400: Category_id does not exist, invalid level/category in variants, or active variant removal block
            403: Only HR can update KRAs
            404: KRA not found
            401: Unauthorized
        """
        return self._update(request, kra_id, partial=True)

    def delete(self, request: Request, kra_id: int) -> Response:
        """
        API view to delete a KRA.

        Endpoint: DELETE /api/v1/kra/library_kra/<kra_id>

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "message": "KRA and all its level variants deleted successfully"
            }

        Error Responses:
            403: Only HR can delete KRAs
            409: Cannot delete - KRA's level variants are assigned to employees
            404: KRA not found
            401: Unauthorized
        """
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
                    "error": "Cannot delete — this KRA's level variants are assigned to employees",
                    "assigned_kra_level_count": active_assignments,
                },
                status=status.HTTP_409_CONFLICT,
            )

        _audit(request, "KRA_DELETED", "KRA", kra.id,
               old_data=KRASerializer(kra).data)

        with transaction.atomic():
            kra.kra_levels.all().delete()   # cascade via related_name
            kra.delete()

        return Response(
            {"message": f"KRA and all its level variants deleted successfully"},
            status=status.HTTP_200_OK,
        )
        
    def _update(self, request: Request, kra_id: int, partial: bool = False) -> Response:
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can update KRAs"},
                            status=status.HTTP_403_FORBIDDEN)

        kra      = get_object_or_404(KRA, id=kra_id)
        old_data = KRASerializer(kra).data
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
            submitted_level_ids = {level_item.get("level_id") for level_item in levels_data if level_item.get("level_id")}
            submitted_cat_ids   = {level_item.get("category_id") for level_item in levels_data if level_item.get("category_id")}

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
            incoming_level_ids = {level_item.get("level_id") for level_item in levels_data if level_item.get("level_id")}
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
                for level_item in levels_data:
                    level_id    = level_item.get("level_id")
                    level_name  = level_item.get("name", kra.name)
                    category_id = level_item.get("category_id") or kra.category_id

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
            old_data=old_data, new_data=KRASerializer(kra).data)

        kra.refresh_from_db()
        return Response(KRASerializer(kra).data, status=status.HTTP_200_OK)


class KRACloneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, kra_id: int) -> Response:
        """
        API view to clone a KRA and its level variants.

        Endpoint: POST /api/v1/kra/library_kra/<kra_id>/clone

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "<new_cloned_name>",
                "category_id": 1
            }

        Response (201):
            {
                "cloned_from": 1,
                "id": 2,
                "name": "<new_cloned_name>",
                "description": "<source_description>",
                "is_standard": true,
                "category_id": 1,
                "category_name": "...",
                "levels": [...]
            }

        Error Responses:
            400: Category_id does not exist
            403: Only HR can clone KRAs
            404: KRA not found
            401: Unauthorized
        """
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

        # Fetch level variants using raw SQL
        sql = """
            SELECT kl.id, kl.kra_id, kl.level_id, kl.name, kl.category_id,
                   l.name AS lvl_name, l.description AS lvl_desc, l.min_experience AS lvl_min_exp, l.max_experience AS lvl_max_exp,
                   c.name AS cat_name, c.description AS cat_desc, c.is_standard AS cat_std
            FROM kra_level kl
            LEFT JOIN level l ON kl.level_id = l.id
            LEFT JOIN kra_category c ON kl.category_id = c.id
            WHERE kl.kra_id = %s
        """
        raw_qs = KRALevel.objects.raw(sql, [source.id])
        source_levels = []
        for kl in raw_qs:
            if kl.level_id:
                kl.level = Level(
                    id=kl.level_id,
                    name=getattr(kl, 'lvl_name', None),
                    description=getattr(kl, 'lvl_desc', None),
                    min_experience=getattr(kl, 'lvl_min_exp', None),
                    max_experience=getattr(kl, 'lvl_max_exp', None)
                )
            else:
                kl.level = None

            if kl.category_id:
                kl.category = KRACategory(
                    id=kl.category_id,
                    name=getattr(kl, 'cat_name', None),
                    description=getattr(kl, 'cat_desc', None),
                    is_standard=getattr(kl, 'cat_std', False)
                )
            else:
                kl.category = None

            source_levels.append(kl)


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
                    level_id=kra_level.level_id,
                    name=kra_level.name,
                    category_id=kra_level.category_id,
                )
                for kra_level in source_levels
            ])

        _audit(request, "KRA_CLONED", "KRA", clone.id,
               new_data={
                   "cloned_from":   source.id,
                   "levels_cloned": len(source_levels),
                   **KRASerializer(clone, context={'include_levels': False}).data,
               })

        clone.refresh_from_db()
        return Response(
            {"cloned_from": source.id, **KRASerializer(clone).data},
            status=status.HTTP_201_CREATED,
        )



# KRA LEVEL  (child of KRA — the level-specific variant)

class KRALevelListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, kra_id: int) -> Response:
        """
        API view to list all level variants for a specific KRA.

        Endpoint: GET /api/v1/kra/library/<kra_id>/levels

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "kra_id": 1,
                "levels": [
                    {
                        "id": 1,
                        "kra_id": 1,
                        "level_id": 1,
                        "level_name": "Dev-01",
                        "name": "Level variant name",
                        "category_id": 1,
                        "category_name": "..."
                    }
                ]
            }

        Error Responses:
            404: KRA not found
            401: Unauthorized
        """
        kra = get_object_or_404(KRA, id=kra_id)
        sql = """
            SELECT kl.id, kl.kra_id, kl.level_id, kl.name, kl.category_id,
                   l.name AS lvl_name, l.description AS lvl_desc, l.min_experience AS lvl_min_exp, l.max_experience AS lvl_max_exp,
                   c.name AS cat_name, c.description AS cat_desc, c.is_standard AS cat_std
            FROM kra_level kl
            LEFT JOIN level l ON kl.level_id = l.id
            LEFT JOIN kra_category c ON kl.category_id = c.id
            WHERE kl.kra_id = %s
        """
        raw_qs = KRALevel.objects.raw(sql, [kra_id])
        levels = []
        for kl in raw_qs:
            if kl.level_id:
                kl.level = Level(
                    id=kl.level_id,
                    name=getattr(kl, 'lvl_name', None),
                    description=getattr(kl, 'lvl_desc', None),
                    min_experience=getattr(kl, 'lvl_min_exp', None),
                    max_experience=getattr(kl, 'lvl_max_exp', None)
                )
            else:
                kl.level = None

            if kl.category_id:
                kl.category = KRACategory(
                    id=kl.category_id,
                    name=getattr(kl, 'cat_name', None),
                    description=getattr(kl, 'cat_desc', None),
                    is_standard=getattr(kl, 'cat_std', False)
                )
            else:
                kl.category = None

            levels.append(kl)

        return Response(
            {"kra_id": kra_id, "levels": KRALevelSerializer(levels, many=True).data},
            status=status.HTTP_200_OK,
        )


    def post(self, request: Request, kra_id: int) -> Response:
        """
        API view to add a new level variant to a KRA.

        Endpoint: POST /api/v1/kra/library/<kra_id>/levels

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "level_id": 1,
                "name": "Dev-01 specific name",
                "category_id": 1
            }

        Response (201):
            {
                "id": 1,
                "kra_id": 1,
                "level_id": 1,
                "level_name": "Dev-01",
                "name": "Dev-01 specific name",
                "category_id": 1,
                "category_name": "..."
            }

        Error Responses:
            400: level_id is required, level_id does not exist, category_id does not exist, or variant already exists
            403: Only HR can add KRA level variants
            404: KRA not found
            401: Unauthorized
        """
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

        kra_level = KRALevel.objects.create(
            kra=kra,
            level_id=level_id,
            name=data.get("name", kra.name),
            category_id=category_id,
        )

        _audit(request, "KRA_LEVEL_CREATED", "KRALevel", kra_level.id,
               new_data=KRALevelSerializer(kra_level).data)

        return Response(KRALevelSerializer(kra_level).data, status=status.HTTP_201_CREATED)


class KRALevelDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_kra_level(self, kra_id: int, kra_level_id: int) -> KRALevel:
        sql = """
            SELECT kl.id, kl.kra_id, kl.level_id, kl.name, kl.category_id,
                   l.name AS lvl_name, l.description AS lvl_desc, l.min_experience AS lvl_min_exp, l.max_experience AS lvl_max_exp,
                   c.name AS cat_name, c.description AS cat_desc, c.is_standard AS cat_std
            FROM kra_level kl
            LEFT JOIN level l ON kl.level_id = l.id
            LEFT JOIN kra_category c ON kl.category_id = c.id
            WHERE kl.id = %s AND kl.kra_id = %s
        """
        raw_qs = KRALevel.objects.raw(sql, [kra_level_id, kra_id])
        levels = list(raw_qs)
        if not levels:
            from django.http import Http404
            raise Http404("No KRALevel matches the given query.")

        kra_level = levels[0]
        if kra_level.level_id:
            kra_level.level = Level(
                id=kra_level.level_id,
                name=getattr(kra_level, 'lvl_name', None),
                description=getattr(kra_level, 'lvl_desc', None),
                min_experience=getattr(kra_level, 'lvl_min_exp', None),
                max_experience=getattr(kra_level, 'lvl_max_exp', None)
            )
        else:
            kra_level.level = None

        if kra_level.category_id:
            kra_level.category = KRACategory(
                id=kra_level.category_id,
                name=getattr(kra_level, 'cat_name', None),
                description=getattr(kra_level, 'cat_desc', None),
                is_standard=getattr(kra_level, 'cat_std', False)
            )
        else:
            kra_level.category = None

        return kra_level


    def get(self, request: Request, kra_id: int, kra_level_id: int) -> Response:
        """
        API view to retrieve a specific KRA level variant.

        Endpoint: GET /api/v1/kra/library/<kra_id>/levels/<kra_level_id>

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "id": 1,
                "kra_id": 1,
                "level_id": 1,
                "level_name": "Dev-01",
                "name": "Dev-01 specific name",
                "category_id": 1,
                "category_name": "..."
            }

        Error Responses:
            404: KRA level variant not found
            401: Unauthorized
        """
        kra_level = self._get_kra_level(kra_id, kra_level_id)
        return Response(KRALevelSerializer(kra_level).data, status=status.HTTP_200_OK)

    def _update(self, request: Request, kra_id: int, kra_level_id: int, partial: bool = False) -> Response:
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can update KRA level variants"},
                            status=status.HTTP_403_FORBIDDEN)

        kra_level = self._get_kra_level(kra_id, kra_level_id)
        old_data  = KRALevelSerializer(kra_level).data
        data      = request.data

        new_level_id = data.get("level_id")
        if new_level_id and new_level_id != kra_level.level_id:
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
            kra_level.level_id = new_level_id

        if "name" in data:
            kra_level.name = data["name"]

        if "category_id" in data and data["category_id"]:
            if not KRACategory.objects.filter(id=data["category_id"]).exists():
                return Response(
                    {"error": f"category_id {data['category_id']} does not exist"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            kra_level.category_id = data["category_id"]

        kra_level.save()

        _audit(request, "KRA_LEVEL_UPDATED", "KRALevel", kra_level.id,
               old_data=old_data, new_data=KRALevelSerializer(kra_level).data)

        return Response(KRALevelSerializer(kra_level).data, status=status.HTTP_200_OK)

    def put(self, request: Request, kra_id: int, kra_level_id: int) -> Response:
        """
        API view to fully update a specific KRA level variant.

        Endpoint: PUT /api/v1/kra/library/<kra_id>/levels/<kra_level_id>

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "level_id": 1,
                "name": "Dev-01 specific name",
                "category_id": 1
            }

        Response (200):
            {
                "id": 1,
                "kra_id": 1,
                "level_id": 1,
                "level_name": "Dev-01",
                "name": "Dev-01 specific name",
                "category_id": 1,
                "category_name": "..."
            }

        Error Responses:
            400: level_id does not exist, category_id does not exist, or variant already exists on this level
            403: Only HR can update KRA level variants
            404: KRA level variant not found
            401: Unauthorized
        """
        return self._update(request, kra_id, kra_level_id, partial=False)

    def patch(self, request: Request, kra_id: int, kra_level_id: int) -> Response:
        """
        API view to partially update a specific KRA level variant.

        Endpoint: PATCH /api/v1/kra/library/<kra_id>/levels/<kra_level_id>

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "level_id": 1,
                "name": "Dev-01 specific name",
                "category_id": 1
            }

        Response (200):
            {
                "id": 1,
                "kra_id": 1,
                "level_id": 1,
                "level_name": "Dev-01",
                "name": "Dev-01 specific name",
                "category_id": 1,
                "category_name": "..."
            }

        Error Responses:
            400: level_id does not exist, category_id does not exist, or variant already exists on this level
            403: Only HR can update KRA level variants
            404: KRA level variant not found
            401: Unauthorized
        """
        return self._update(request, kra_id, kra_level_id, partial=True)

    def delete(self, request: Request, kra_id: int, kra_level_id: int) -> Response:
        """
        API view to delete a KRA level variant.

        Endpoint: DELETE /api/v1/kra/library/<kra_id>/levels/<kra_level_id>

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "message": "KRA level variant deleted successfully"
            }

        Error Responses:
            400: Cannot delete - variant is assigned to employees
            403: Only HR can delete KRA level variants
            404: KRA level variant not found
            401: Unauthorized
        """
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response({"error": "Only HR can delete KRA level variants"},
                            status=status.HTTP_403_FORBIDDEN)

        kra_level = self._get_kra_level(kra_id, kra_level_id)

        assigned_count = kra_level.employee_kra_levels.count()   # related_name on EmployeeKRALevel.kra_level
        if assigned_count:
            return Response(
                {
                    "error": "Cannot delete — this KRA level variant is assigned to employees",
                    "assigned_employee_count": assigned_count,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        _audit(request, "KRA_LEVEL_DELETED", "KRALevel", kra_level.id,
               old_data=KRALevelSerializer(kra_level).data)
        kra_level.delete()

        return Response(
            {"message": "KRA level variant deleted successfully"},
            status=status.HTTP_200_OK,
        )


class KRALevelCloneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, kra_id: int, kra_level_id: int) -> Response:
        """
        API view to clone a KRA level variant.

        Endpoint: POST /api/v1/kra/library/<kra_id>/levels/<kra_level_id>/clone

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "level_id": 1,
                "target_kra_id": 1,
                "name": "Dev-01 specific name",
                "category_id": 1
            }

        Response (201):
            {
                "cloned_from": 1,
                "source_kra_id": 1,
                "target_kra_id": 1,
                "id": 2,
                "kra_id": 1,
                "level_id": 1,
                "level_name": "Dev-01",
                "name": "Dev-01 specific name",
                "category_id": 1,
                "category_name": "..."
            }

        Error Responses:
            400: level_id is required/does not exist, target_kra_id does not exist, category_id does not exist, or variant already exists
            403: Only HR can clone KRA level variants
            404: KRA level variant not found
            401: Unauthorized
        """
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
                   **KRALevelSerializer(clone).data,
               })

        return Response(
            {
                "cloned_from": source.id,
                "source_kra_id": kra_id,
                "target_kra_id": target_kra_id,
                **KRALevelSerializer(clone).data,
            },
            status=status.HTTP_201_CREATED,
        )