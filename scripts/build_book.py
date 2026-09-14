"""Extract the local EPUB in spine order, using only Python's standard library."""
import json
import pathlib
import posixpath
import xml.etree.ElementTree as ET
import zipfile
import hashlib
from clean_text import clean_paragraphs
from urllib.parse import unquote

ROOT = pathlib.Path(__file__).resolve().parents[1]
source = next(ROOT.glob('*.epub'))
output = ROOT / 'docs' / 'book'
output.mkdir(parents=True, exist_ok=True)
chapters = []
audit = []
with zipfile.ZipFile(source) as archive:
    container = ET.fromstring(archive.read('META-INF/container.xml'))
    package_path = container.find('.//{*}rootfile').attrib['full-path']
    package = ET.fromstring(archive.read(package_path))
    manifest = {item.attrib['id']: item.attrib for item in package.findall('.//{*}manifest/{*}item')}
    for ref in package.findall('.//{*}spine/{*}itemref'):
        item = manifest[ref.attrib['idref']]
        path = posixpath.normpath(posixpath.join(posixpath.dirname(package_path), unquote(item['href'])))
        doc = ET.fromstring(archive.read(path))
        heading = doc.find('.//{*}h1')
        if heading is None:
            heading = doc.find('.//{*}title')
        title = ''.join(heading.itertext()).strip() if heading is not None else item['id']
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
(output / 'index.json').write_text(json.dumps({'title': '蛊真人', 'chapters': chapters}, ensure_ascii=False), encoding='utf-8')
print(f'Extracted {len(chapters)} entries; {sum(c["words"] for c in chapters):,} characters.')
report = ROOT / 'reports'
report.mkdir(exist_ok=True)
summary = {'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'entries': len(chapters),
           'affected_entries': len(audit), 'changed_paragraphs_or_labels': sum(len(a['changes']) for a in audit),
           'removed_characters': sum(len(c['before']) - len(c['after']) for a in audit for c in a['changes'])}
(report / 'cleaning-audit.json').write_text(json.dumps({'summary': summary, 'chapters': audit}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(summary))
