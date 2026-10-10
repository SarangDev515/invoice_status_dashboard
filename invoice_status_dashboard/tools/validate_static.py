"""Read-only static checks; no database, registry startup or bytecode writes."""
import ast
from pathlib import Path
import subprocess
from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
ODOO = ROOT.parents[1]
checks = []
for path in ROOT.rglob('*.py'):
    ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
    checks.append(f'Python syntax: {path.relative_to(ROOT)}')
manifest = ast.literal_eval((ROOT / '__manifest__.py').read_text(encoding='utf-8'))
assert manifest['version'].startswith('19.0.')
for relative in manifest['data']:
    assert (ROOT / relative).is_file(), relative
for patterns in manifest['assets'].values():
    for pattern in patterns:
        module, relative = pattern.split('/', 1)
        assert module == ROOT.name
        assert list(ROOT.glob(relative)), pattern
checks.append('Manifest dependencies, data paths and asset patterns')
for path in ROOT.rglob('*.xml'):
    etree.parse(str(path))
    checks.append(f'XML well-formed: {path.relative_to(ROOT)}')
core_list = etree.parse(str(ODOO / 'addons/web/static/src/views/list/list_controller.xml'))
assert len(core_list.xpath("//t[@t-set-slot='layout-actions']")) == 1
assert len(core_list.xpath("//t[@t-set-slot='control-panel-navigation-additional']/t[@t-component]")) == 1
core_view = etree.parse(str(ODOO / 'addons/account/views/account_move_views.xml'))
assert len(core_view.xpath("//record[@id='view_invoice_tree']/field[@name='arch']/list")) == 1
checks.append('Both inheritance XPath targets exist uniquely in local Odoo source')
for path in ROOT.rglob('*.js'):
    result = subprocess.run(['node', '--input-type=module', '--check'], input=path.read_text(encoding='utf-8'), text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f'{path}: {result.stderr}')
    checks.append(f'JavaScript syntax: {path.relative_to(ROOT)}')
for line in checks:
    print('PASS', line)
print(f'{len(checks)} static checks passed. No live Odoo runtime or database tests performed.')
