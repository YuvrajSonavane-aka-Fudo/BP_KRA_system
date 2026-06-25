from collections import defaultdict
from typing import Any
from django.db import connection

def get_employee_roles_map(employee_ids: list[int]) -> dict[int, list[str]]:
    """
    Fetch roles for a list of employees using raw SQL.
    Replaced ORM join query with raw SQL for readability and performance.
    """
    if not employee_ids:
        return defaultdict(list)
    roles_map: dict[int, list[str]] = defaultdict(list)
    with connection.cursor() as cursor:
        placeholders = ', '.join(['%s'] * len(employee_ids))
        query = f"""
            SELECT er.employee_id, r.name AS role_name
            FROM employee_role er
            INNER JOIN role r ON er.role_id = r.id
            WHERE er.employee_id IN ({placeholders})
        """
        cursor.execute(query, employee_ids)
        for emp_id, role_name in cursor.fetchall():
            if role_name:
                roles_map[emp_id].append(role_name)
    return roles_map

def get_cycle_data_maps(cycle_id: int, employee_ids: list[int]) -> tuple[dict[int, int], dict[int, list[dict[str, Any]]], dict[int, list[dict[str, Any]]]]:
    """
    Fetch enrolled cycle data, kra levels, and categories for a list of employees.
    Replaced multiple ORM queries with parameterized raw SQL for better performance.
    """
    cycle_map: dict[int, int] = {}
    kra_map: dict[int, list[dict[str, Any]]] = defaultdict(list)
    category_map: dict[int, list[dict[str, Any]]] = defaultdict(list)
    
    if not cycle_id or not employee_ids:
        return cycle_map, kra_map, category_map
        
    placeholders = ', '.join(['%s'] * len(employee_ids))
    with connection.cursor() as cursor:
        # Fetch enrolled employees
        query_ekc = f"""
            SELECT id, employee_id
            FROM employee_kra_cycle
            WHERE kra_cycle_id = %s AND employee_id IN ({placeholders})
        """
        params = [cycle_id] + employee_ids
        cursor.execute(query_ekc, params)
        for row in cursor.fetchall():
            cycle_map[row[1]] = row[0]
            
        if not cycle_map:
            return cycle_map, kra_map, category_map
            
        ekc_ids = list(cycle_map.values())
        ekc_to_emp = {v: k for k, v in cycle_map.items()}
        ekc_placeholders = ', '.join(['%s'] * len(ekc_ids))
        
        # Fetch KRA assignments with employee and category details
        query_kras = f"""
            SELECT DISTINCT ekl.employee_kra_cycle_id, ekl.kra_level_id, 
                   kl.kra_id, k.name, ekl.assigned_by_role
            FROM employee_kra_level ekl
            INNER JOIN kra_level kl ON ekl.kra_level_id = kl.id
            INNER JOIN kra k ON kl.kra_id = k.id
            WHERE ekl.employee_kra_cycle_id IN ({ekc_placeholders})
        """
        cursor.execute(query_kras, ekc_ids)
        for ekc_id, kra_level_id, kra_id, kra_name, assigned_by_role in cursor.fetchall():
            emp_id = ekc_to_emp.get(ekc_id)
            if emp_id is not None:
                kra_map[emp_id].append({
                    "kra_level_id": kra_level_id,
                    "kra_id": kra_id,
                    "name": kra_name,
                    "assigned_by_role": assigned_by_role,
                })
                
        # Fetch Category weightages
        query_cats = f"""
            SELECT employee_kra_cycle_id, category_id, weightage, assigned_by_role
            FROM employee_kra_cycle_category
            WHERE employee_kra_cycle_id IN ({ekc_placeholders})
        """
        cursor.execute(query_cats, ekc_ids)
        for ekc_id, category_id, weightage, assigned_by_role in cursor.fetchall():
            emp_id = ekc_to_emp.get(ekc_id)
            if emp_id is not None:
                category_map[emp_id].append({
                    "category_id": category_id,
                    "weightage": weightage,
                    "assigned_by_role": assigned_by_role,
                })
                
    return cycle_map, kra_map, category_map

def get_all_cycle_ids_map(employee_ids: list[int]) -> dict[int, list[int]]:
    """
    Fetch all cycle IDs for employees.
    """
    if not employee_ids:
        return defaultdict(list)
    all_cycle_ids_map: dict[int, list[int]] = defaultdict(list)
    with connection.cursor() as cursor:
        placeholders = ', '.join(['%s'] * len(employee_ids))
        query = f"""
            SELECT employee_id, kra_cycle_id
            FROM employee_kra_cycle
            WHERE employee_id IN ({placeholders})
        """
        cursor.execute(query, employee_ids)
        for emp_id, kra_cycle_id in cursor.fetchall():
            all_cycle_ids_map[emp_id].append(kra_cycle_id)
    return all_cycle_ids_map
def get_active_employees(caller_id: int, is_hr: bool) -> list[dict[str, Any]]:
    """
    Fetch active employees with department, level, and role names.
    Replaced ORM select_related query with raw SQL for readability and performance.
    """
    query = """
        SELECT e.id, e.first_name, e.last_name, e.email, e.title, e.manager_id,
               d.department_name, l.name AS level_name, r.name AS role_name
        FROM employee e
        LEFT JOIN department d ON e.department_id = d.id
        LEFT JOIN level l ON e.level_id = l.id
        LEFT JOIN role r ON e.role = r.id
        WHERE e.active = TRUE
    """
    params = []
    if not is_hr:
        query += " AND e.manager_id = %s"
        params.append(caller_id)
        
    employees_list = []
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        for row in cursor.fetchall():
            employees_list.append({
                "id": row[0],
                "first_name": row[1],
                "last_name": row[2],
                "email": row[3],
                "title": row[4],
                "manager_id": row[5],
                "department_name": row[6],
                "level_name": row[7],
                "role_name": row[8]
            })
    return employees_list
