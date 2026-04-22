from django.urls import path
from .views import (
    KRALevelCloneView,
    KRALevelDetailView,
    KRALevelListCreateView,
    KRACloneView,
    KRADetailView,
    KRALibraryListCreateView,
    LevelCloneView,
    LevelDetailView,
    LevelListCreateView,
    KRACategoryCloneView,
    KRACategoryDetailView,
    KRACategoryListCreateView,
)


urlpatterns = [

    path('kra/categories', KRACategoryListCreateView.as_view()),
    path('kra/categories/<int:category_id>', KRACategoryDetailView.as_view()),
    path('kra/categories/<int:category_id>/clone', KRACategoryCloneView.as_view()),

    path('levels',LevelListCreateView.as_view()),
    path('levels/<int:level_id>', LevelDetailView.as_view()),
    path('levels/<int:level_id>/clone',LevelCloneView.as_view()),

    path('kra/library_kra',KRALibraryListCreateView.as_view()),
    path('kra/library_kra/<int:kra_id>', KRADetailView.as_view()),
    path('kra/library_kra/<int:kra_id>/clone', KRACloneView.as_view()),

    path('kra/library/<int:kra_id>/levels', KRALevelListCreateView.as_view()),
    path('kra/library/<int:kra_id>/levels/<int:kra_level_id>', KRALevelDetailView.as_view()),
    path('kra/library/<int:kra_id>/levels/<int:kra_level_id>/clone',KRALevelCloneView.as_view()),
]