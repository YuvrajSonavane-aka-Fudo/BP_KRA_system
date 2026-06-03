import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from kra_cycle.models import EmployeeKRACycle, EmployeeKRALevel, Employee

caller = Employee.objects.get(id=1009)
ekc = EmployeeKRACycle.objects.filter(employee=caller, kra_cycle_id=66).first()
print("EKC ID:", ekc.id if ekc else None)

rows = EmployeeKRALevel.objects.filter(employee=caller, employee_kra_cycle=ekc)
print("New count:", rows.count())
for r in rows:
    print("NEW", r.id, r.employee_id, r.employee_kra_cycle_id)

old = ekc.kra_level_rows.all()
print("Old count:", old.count())
for r in old:
    print("OLD", r.id, r.employee_id, r.employee_kra_cycle_id)
    
rows = EmployeeKRALevel.objects.select_related(
    'kra_level__kra',
    'kra_level__category',
).filter(employee=caller, employee_kra_cycle=ekc)

for r in rows:
    kra_name = (
        r.kra_level.name
        or (r.kra_level.kra.name if r.kra_level and r.kra_level.kra else None)
    ) if r.kra_level else None
    print(f"EKL {r.id} | kra_name={kra_name}")