"""
PDF Generation Service using Jinja2 and Tectonic LaTeX Engine
Matches specification from latex_integration_guide.md
"""
import re
import os
import tempfile
import subprocess
import jinja2
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter()

def escape_latex(text: str) -> str:
    """Escapes special LaTeX characters to prevent compile breaks."""
    if not isinstance(text, str):
        return str(text) if text is not None else ""
    conv = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\textasciicircum{}',
        '\\': r'\textbackslash{}',
    }
    regex = re.compile('|'.join(re.escape(str(key)) for key in sorted(conv.keys(), key=lambda item: -len(item))))
    return regex.sub(lambda match: conv[match.group()], text)

# Configure Jinja2 to avoid LaTeX syntax conflicts
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates')
jinja_env = jinja2.Environment(
    block_start_string=r'\BLOCK{',
    block_end_string='}',
    variable_start_string=r'\VAR{',
    variable_end_string='}',
    comment_start_string=r'\#{',
    comment_end_string='}',
    line_statement_prefix='%%',
    line_comment_prefix='%#',
    trim_blocks=True,
    autoescape=False,
    loader=jinja2.FileSystemLoader(TEMPLATE_DIR)
)
jinja_env.filters['escape_latex'] = escape_latex

@router.post("/compile")
async def compile_resume(resume_data: dict):
    """Compiles resume JSON into a single-page PDF via Tectonic."""
    try:
        template = jinja_env.get_template("resume_template.tex")
        rendered_tex = template.render(**resume_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render LaTeX template: {str(e)}")

    # Use a temporary directory for safe concurrent compilation
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_file_path = os.path.join(tmpdir, "resume.tex")
        pdf_file_path = os.path.join(tmpdir, "resume.pdf")

        with open(tex_file_path, "w", encoding="utf-8") as f:
            f.write(rendered_tex)

        # Execute Tectonic compiler
        try:
            result = subprocess.run(
                ["tectonic", "resume.tex"],
                cwd=tmpdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
        except FileNotFoundError:
            raise HTTPException(
                status_code=500,
                detail="Tectonic compiler executable not found. Install via 'winget install tectonic' or brew/apt."
            )

        if result.returncode != 0:
            print(f"Tectonic Error: {result.stderr}")
            raise HTTPException(status_code=400, detail=f"Failed to compile LaTeX document: {result.stderr}")

        # Read the generated PDF
        if not os.path.exists(pdf_file_path):
            raise HTTPException(status_code=500, detail="PDF output was not produced.")

        with open(pdf_file_path, "rb") as f:
            pdf_bytes = f.read()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="resume.pdf"'}
    )

@router.post("/export-latex")
async def export_latex(resume_data: dict):
    """Returns raw rendered LaTeX .tex string."""
    try:
        template = jinja_env.get_template("resume_template.tex")
        rendered_tex = template.render(**resume_data)
        return {"success": True, "texSource": rendered_tex}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render LaTeX: {str(e)}")
