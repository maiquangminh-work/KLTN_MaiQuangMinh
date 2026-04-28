from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"D:\.vscode\KLTN\Demo")
OUT_DIR = ROOT / "figures"
PNG_PATH = OUT_DIR / "walk_forward_validation_5_windows.png"
SVG_PATH = OUT_DIR / "walk_forward_validation_5_windows.svg"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates.extend(
            [
                r"C:\Windows\Fonts\segoeuib.ttf",
                r"C:\Windows\Fonts\arialbd.ttf",
                r"C:\Windows\Fonts\calibrib.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                r"C:\Windows\Fonts\segoeui.ttf",
                r"C:\Windows\Fonts\arial.ttf",
                r"C:\Windows\Fonts\calibri.ttf",
            ]
        )
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def draw_centered_text(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, font, fill):
    left, top, right, bottom = box
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = left + (right - left - tw) / 2
    y = top + (bottom - top - th) / 2 - 2
    draw.text((x, y), text, font=font, fill=fill)


def draw_png() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    width, height = 1800, 1080
    img = Image.new("RGB", (width, height), "#FFFFFF")
    draw = ImageDraw.Draw(img)

    title_font = load_font(42, bold=True)
    subtitle_font = load_font(24)
    label_font = load_font(26, bold=True)
    box_font = load_font(24, bold=True)
    axis_font = load_font(24, bold=True)
    legend_font = load_font(22)

    train_color = "#4F81BD"
    val_color = "#F4A261"
    test_color = "#5CB85C"
    border_color = "#355C7D"
    text_dark = "#1F2937"
    grid_color = "#D9E2EC"

    draw.text((80, 60), "Sơ đồ Walk-Forward Validation với 5 cửa sổ trượt", font=title_font, fill=text_dark)
    draw.text(
        (80, 120),
        "Mỗi cửa sổ gồm tập huấn luyện 756 ngày, tập xác thực 126 ngày và tập kiểm thử 63 ngày; cửa sổ kế tiếp dịch sang phải theo thời gian.",
        font=subtitle_font,
        fill="#4B5563",
    )

    base_x = 340
    base_y = 240
    row_gap = 125
    box_h = 64
    shift = 90
    # Schematic widths: keep relative order Train > Val > Test, but enlarge
    # the shorter blocks so labels remain readable in a thesis figure.
    train_w = 700
    val_w = 140
    test_w = 110

    # light guide lines
    for i in range(5):
        y = base_y + i * row_gap + box_h // 2
        draw.line((base_x - 20, y, width - 140, y), fill=grid_color, width=1)

    for i in range(5):
        y = base_y + i * row_gap
        x = base_x + i * shift
        draw.text((90, y + 15), f"Window {i + 1}", font=label_font, fill=text_dark)

        train_box = (x, y, x + train_w, y + box_h)
        val_box = (x + train_w, y, x + train_w + val_w, y + box_h)
        test_box = (x + train_w + val_w, y, x + train_w + val_w + test_w, y + box_h)

        draw.rounded_rectangle(train_box, radius=12, fill=train_color, outline=border_color, width=2)
        draw.rounded_rectangle(val_box, radius=12, fill=val_color, outline=border_color, width=2)
        draw.rounded_rectangle(test_box, radius=12, fill=test_color, outline=border_color, width=2)

        draw_centered_text(draw, train_box, "Train 756d", box_font, "white")
        draw_centered_text(draw, val_box, "Val 126d", box_font, "white")
        draw_centered_text(draw, test_box, "Test 63d", box_font, "white")

    # axis
    axis_y = base_y + 5 * row_gap + 70
    axis_start = base_x
    axis_end = width - 170
    draw.line((axis_start, axis_y, axis_end, axis_y), fill=text_dark, width=4)
    draw.polygon(
        [(axis_end, axis_y), (axis_end - 24, axis_y - 14), (axis_end - 24, axis_y + 14)],
        fill=text_dark,
    )
    draw.text((axis_end - 60, axis_y + 18), "Thời gian", font=axis_font, fill=text_dark)

    # legend
    legend_y = axis_y + 110
    legend_items = [("Train", train_color), ("Validation", val_color), ("Test", test_color)]
    lx = 360
    for label, color in legend_items:
        draw.rounded_rectangle((lx, legend_y, lx + 44, legend_y + 28), radius=6, fill=color, outline=border_color, width=1)
        draw.text((lx + 60, legend_y - 2), label, font=legend_font, fill=text_dark)
        lx += 250

    draw.text((80, height - 70), "Nguồn: Tác giả tự xây dựng", font=subtitle_font, fill="#6B7280")
    img.save(PNG_PATH, dpi=(300, 300))


def draw_svg() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    width, height = 1800, 1080
    base_x = 340
    base_y = 240
    row_gap = 125
    box_h = 64
    shift = 90
    train_w = 700
    val_w = 140
    test_w = 110

    train_color = "#4F81BD"
    val_color = "#F4A261"
    test_color = "#5CB85C"
    border_color = "#355C7D"
    text_dark = "#1F2937"
    grid_color = "#D9E2EC"

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#FFFFFF"/>',
        '<style>',
        '.title{font:700 42px Segoe UI, Arial, sans-serif; fill:#1F2937;}',
        '.subtitle{font:24px Segoe UI, Arial, sans-serif; fill:#4B5563;}',
        '.rowlabel{font:700 26px Segoe UI, Arial, sans-serif; fill:#1F2937;}',
        '.boxtext{font:700 24px Segoe UI, Arial, sans-serif; fill:#FFFFFF;}',
        '.axis{font:700 24px Segoe UI, Arial, sans-serif; fill:#1F2937;}',
        '.legend{font:22px Segoe UI, Arial, sans-serif; fill:#1F2937;}',
        '</style>',
        '<text x="80" y="95" class="title">Sơ đồ Walk-Forward Validation với 5 cửa sổ trượt</text>',
        '<text x="80" y="145" class="subtitle">Mỗi cửa sổ gồm tập huấn luyện 756 ngày, tập xác thực 126 ngày và tập kiểm thử 63 ngày; cửa sổ kế tiếp dịch sang phải theo thời gian.</text>',
    ]

    for i in range(5):
        y = base_y + i * row_gap + box_h / 2
        lines.append(f'<line x1="{base_x - 20}" y1="{y}" x2="{width - 140}" y2="{y}" stroke="{grid_color}" stroke-width="1"/>')

    for i in range(5):
        y = base_y + i * row_gap
        x = base_x + i * shift
        lines.append(f'<text x="90" y="{y + 42}" class="rowlabel">Window {i + 1}</text>')

        def rect(x0, w, color, label):
            cx = x0 + w / 2
            cy = y + box_h / 2 + 8
            lines.append(
                f'<rect x="{x0}" y="{y}" rx="12" ry="12" width="{w}" height="{box_h}" fill="{color}" stroke="{border_color}" stroke-width="2"/>'
            )
            lines.append(f'<text x="{cx}" y="{cy}" text-anchor="middle" class="boxtext">{label}</text>')

        rect(x, train_w, train_color, "Train 756d")
        rect(x + train_w, val_w, val_color, "Val 126d")
        rect(x + train_w + val_w, test_w, test_color, "Test 63d")

    axis_y = base_y + 5 * row_gap + 70
    axis_end = width - 170
    lines.append(f'<line x1="{base_x}" y1="{axis_y}" x2="{axis_end}" y2="{axis_y}" stroke="{text_dark}" stroke-width="4"/>')
    lines.append(
        f'<polygon points="{axis_end},{axis_y} {axis_end - 24},{axis_y - 14} {axis_end - 24},{axis_y + 14}" fill="{text_dark}"/>'
    )
    lines.append(f'<text x="{axis_end - 60}" y="{axis_y + 46}" class="axis">Thời gian</text>')

    legend_y = axis_y + 110
    legend_x = 360
    for label, color in [("Train", train_color), ("Validation", val_color), ("Test", test_color)]:
        lines.append(
            f'<rect x="{legend_x}" y="{legend_y}" rx="6" ry="6" width="44" height="28" fill="{color}" stroke="{border_color}" stroke-width="1"/>'
        )
        lines.append(f'<text x="{legend_x + 60}" y="{legend_y + 22}" class="legend">{label}</text>')
        legend_x += 250

    lines.append('<text x="80" y="1010" class="subtitle" fill="#6B7280">Nguồn: Tác giả tự xây dựng</text>')
    lines.append("</svg>")
    SVG_PATH.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    draw_png()
    draw_svg()
    print(PNG_PATH)
    print(SVG_PATH)
