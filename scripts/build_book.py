"""Extract the local EPUB in spine order, using only Python's standard library."""
import json
import pathlib
import posixpath
import argparse
import xml.etree.ElementTree as ET
import zipfile
import hashlib
from clean_text import clean_paragraphs
from urllib.parse import unquote

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description='Extract an EPUB into the static reader.')
parser.add_argument('source', nargs='?', type=pathlib.Path,
                    help='EPUB path; defaults to the most recently modified EPUB in the project root')
args = parser.parse_args()
if args.source:
    source = args.source.resolve()
else:
    candidates = list(ROOT.glob('*.epub'))
    if not candidates:
        raise SystemExit('No EPUB file found in the project root.')
    source = max(candidates, key=lambda path: path.stat().st_mtime)
if not source.is_file() or source.suffix.lower() != '.epub':
    raise SystemExit(f'Invalid EPUB path: {source}')
output = ROOT / 'docs' / 'book'
output.mkdir(parents=True, exist_ok=True)
# A replacement EPUB can have fewer spine entries. Remove all generated JSON
# first so old chapters cannot remain addressable after a rebuild.
for old_json in output.glob('*.json'):
    old_json.unlink()
chapters = []
audit = []
with zipfile.ZipFile(source) as archive:
    container = ET.fromstring(archive.read('META-INF/container.xml'))
    package_path = container.find('.//{*}rootfile').attrib['full-path']
    package = ET.fromstring(archive.read(package_path))
    manifest = {item.attrib['id']: item.attrib for item in package.findall('.//{*}manifest/{*}item')}
    toc_titles = {}
    ncx_item = next((item for item in manifest.values() if item.get('media-type') == 'application/x-dtbncx+xml'), None)
    if ncx_item:
        ncx_path = posixpath.normpath(posixpath.join(posixpath.dirname(package_path), unquote(ncx_item['href'])))
        ncx = ET.fromstring(archive.read(ncx_path))
        for point in ncx.findall('.//{*}navPoint'):
            content = point.find('./{*}content')
            label = point.findtext('./{*}navLabel/{*}text', default='').strip()
            if content is not None and label:
                href = unquote(content.attrib['src'].split('#', 1)[0])
                full_path = posixpath.normpath(posixpath.join(posixpath.dirname(ncx_path), href))
                toc_titles[full_path] = label
    for ref in package.findall('.//{*}spine/{*}itemref'):
        item = manifest[ref.attrib['idref']]
        path = posixpath.normpath(posixpath.join(posixpath.dirname(package_path), unquote(item['href'])))
        doc = ET.fromstring(archive.read(path))
        heading = doc.find('.//{*}h1')
        if heading is None:
            heading = doc.find('.//{*}title')
        title = ''.join(heading.itertext()).strip() if heading is not None else ''
        title = title or toc_titles.get(path) or item['id']
        paragraphs = [''.join(p.itertext()).strip() for p in doc.findall('.//{*}body//{*}p')]
        source_labels = [''.join(e.itertext()).strip() for e in doc.findall('.//{*}body//{*}blockquote')]
        paragraphs, changes = clean_paragraphs(paragraphs, title)
        for label in source_labels:
            if label.startswith('原文：http'):
                changes.append({'paragraph': 'blockquote', 'rules': ['source-link'], 'before': label, 'after': ''})
        if changes:
            audit.append({'source': path, 'title': title, 'changes': changes})
        index = len(chapters)
        data = {'title': title, 'paragraphs': paragraphs}
        (output / f'{index}.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        chapters.append({'id': index, 'title': title, 'words': sum(len(p) for p in paragraphs)})
source_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
start = next((chapter['id'] for chapter in chapters if chapter['title'].startswith('第一节')), 0)
(output / 'index.json').write_text(json.dumps({
    'title': '蛊真人', 'edition': source_sha256, 'start': start, 'chapters': chapters
}, ensure_ascii=False), encoding='utf-8')
print(f'Extracted {len(chapters)} entries; {sum(c["words"] for c in chapters):,} characters.')
report = ROOT / 'reports'
report.mkdir(exist_ok=True)
summary = {'source_sha256': source_sha256, 'source_file': source.name, 'entries': len(chapters),
           'affected_entries': len(audit), 'changed_paragraphs_or_labels': sum(len(a['changes']) for a in audit),
           'removed_characters': sum(len(c['before']) - len(c['after']) for a in audit for c in a['changes'])}
(report / 'cleaning-audit.json').write_text(json.dumps({'summary': summary, 'chapters': audit}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(summary))
