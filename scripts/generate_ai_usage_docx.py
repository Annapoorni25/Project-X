from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape

ROOT = Path(__file__).parent.parent
README = ROOT / "README.md"
OUTPUT = ROOT / "AI-Development-Prompts.docx"


def paragraph(text="", style=None):
    style_xml = f'<w:pStyle w:val="{style}"/>' if style else ""
    return f'<w:p><w:pPr>{style_xml}</w:pPr><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'


def build_document():
    lines = README.read_text(encoding="utf-8").splitlines()
    start = lines.index("## AI development prompt history") + 1
    content = lines[start:]
    body = [paragraph("Project X: AI Development Prompt History", "Title")]
    body.append(paragraph("This document records the important prompts that actually drove Project X development. The prompt text is copied from the project README and is followed by the reason it was used."))

    current_prompt = None
    for line in content:
        if line.startswith("### "):
            body.append(paragraph(line[4:], "Heading1"))
            current_prompt = []
        elif line.startswith("> "):
            current_prompt.append(line[2:])
        elif line.startswith("**Why:**"):
            if current_prompt:
                body.append(paragraph("Original prompt", "Heading2"))
                body.extend(paragraph(prompt_line) for prompt_line in current_prompt)
                current_prompt = []
            body.append(paragraph(line[8:], "IntenseQuote"))
        elif line.strip() == ">":
            current_prompt.append("")

    body_xml = "".join(body) + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr>'
    document = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body_xml}</w:body></w:document>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="IntenseQuote"><w:name w:val="Intense Quote"/><w:rPr><w:i/><w:color w:val="666666"/></w:rPr></w:style>
</w:styles>'''
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'''
    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'''
    document_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'''

    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
        archive.writestr("word/styles.xml", styles)
        archive.writestr("word/_rels/document.xml.rels", document_rels)


if __name__ == "__main__":
    build_document()
    print(OUTPUT)
