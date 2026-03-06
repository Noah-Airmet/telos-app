import argparse
import os
import subprocess
import sys

def extract_pdf(pdf_path: str, output_dir: str):
    """
    Uses the 'marker' CLI to convert a complex multi-column PDF into structured Markdown.
    Marker handles OCR, layout analysis, and reading order automatically.
    
    Before running this script, ensure Marker is installed:
    pip install marker-pdf
    """
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found at {pdf_path}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    
    # Extract the base name to create a dedicated output folder
    base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    book_output_dir = os.path.join(output_dir, base_name)
    
    print(f"Starting Marker extraction for {pdf_path}...")
    print(f"This may take a while depending on the length of the PDF and your hardware.")
    
    try:
        # We call the marker CLI directly. The --output_dir flag tells it where to put the markdown.
        # It creates a subfolder within the output directory containing the .md file and any extracted images.
        subprocess.run(
            ["marker_single", pdf_path, "--output_dir", output_dir],
            check=True
        )
        print(f"\nSuccess! Markdown successfully extracted.")
        print(f"Output located in: {book_output_dir}")
        print(f"\nNext Step:")
        print(f"Pass the generated Markdown file to an AI Agent with Prompt 3 from ai_pipeline_strategy.md")
        print(f"to convert the unstructured Markdown into the Telos JSON Block schema.")
    except subprocess.CalledProcessError as e:
        print(f"Error during Marker extraction: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print("Error: 'marker_single' command not found. Please ensure Marker is installed via pip:")
        print("pip install marker-pdf")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert a complex PDF study bible to Markdown using Marker.")
    parser.add_argument("pdf_path", help="Path to the source PDF file.")
    parser.add_argument("output_dir", help="Directory where the resulting Markdown files should be saved.")
    
    args = parser.parse_args()
    extract_pdf(args.pdf_path, args.output_dir)
