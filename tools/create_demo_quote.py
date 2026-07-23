from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "documents" / "devis-2025-0847.pdf"


def register_fonts():
    regular = Path("C:/Windows/Fonts/arial.ttf")
    bold = Path("C:/Windows/Fonts/arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("Aetheris", str(regular)))
        pdfmetrics.registerFont(TTFont("Aetheris-Bold", str(bold)))
        return "Aetheris", "Aetheris-Bold"
    return "Helvetica", "Helvetica-Bold"


def build_pdf():
    regular, bold = register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Devis 2025-0847 - Document chantier",
        author="Aetheris Terrain",
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="Brand",
            fontName=bold,
            fontSize=18,
            leading=21,
            textColor=HexColor("#17232C"),
            spaceAfter=2 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Eyebrow",
            fontName=bold,
            fontSize=8,
            leading=10,
            textColor=HexColor("#697278"),
            spaceAfter=2 * mm,
            tracking=1.1,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TitleAetheris",
            fontName=bold,
            fontSize=24,
            leading=28,
            textColor=HexColor("#182027"),
            spaceAfter=5 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionAetheris",
            fontName=bold,
            fontSize=10,
            leading=13,
            textColor=HexColor("#182027"),
            spaceBefore=5 * mm,
            spaceAfter=3 * mm,
        )
    )
    body = ParagraphStyle(
        name="BodyAetheris",
        parent=styles["BodyText"],
        fontName=regular,
        fontSize=9.5,
        leading=14,
        textColor=HexColor("#3F4B52"),
        alignment=TA_LEFT,
    )
    small = ParagraphStyle(
        name="SmallAetheris",
        parent=body,
        fontSize=8,
        leading=11,
        textColor=HexColor("#697278"),
    )

    story = [
        Paragraph("AETHERIS TERRAIN", styles["Brand"]),
        Paragraph("DOCUMENT CHANTIER - APERÇU DE DÉMONSTRATION", styles["Eyebrow"]),
        Paragraph("Devis 2025-0847", styles["TitleAetheris"]),
    ]

    status = Table(
        [
            [
                Paragraph("<b>Statut</b><br/>Signé", body),
                Paragraph("<b>Chantier</b><br/>112430", body),
                Paragraph("<b>Mise a jour</b><br/>18/07/2026", body),
            ]
        ],
        colWidths=[55 * mm, 55 * mm, 55 * mm],
    )
    status.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F0F3F1")),
                ("BOX", (0, 0), (-1, -1), 0.8, HexColor("#AEB4B6")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#CFD3D4")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.extend(
        [
            status,
            Paragraph("Projet", styles["SectionAetheris"]),
            Paragraph("<b>Réfection toiture zinc joint debout</b>", body),
            Paragraph("12 rue des Vignes, 68910 Labaroche", body),
            Paragraph("Client : Famille Meyer", body),
            Paragraph("Prestations prévues", styles["SectionAetheris"]),
            ListFlowable(
                [
                    ListItem(Paragraph("Installation et sécurisation de la zone de travail.", body)),
                    ListItem(Paragraph("Dépose contrôlée des éléments de couverture existants.", body)),
                    ListItem(Paragraph("Préparation du support et pose de la volige.", body)),
                    ListItem(Paragraph("Fabrication et pose du zinc a joint debout.", body)),
                    ListItem(Paragraph("Traitement des rives, points singuliers et evacuations.", body)),
                    ListItem(Paragraph("Nettoyage, contrôle final et remise du dossier photo.", body)),
                ],
                bulletType="bullet",
                leftIndent=6 * mm,
                bulletFontName=regular,
                bulletFontSize=7,
                spaceAfter=4 * mm,
            ),
            KeepTogether(
                [
                    Paragraph("Consignes chantier", styles["SectionAetheris"]),
                    Table(
                        [
                            [Paragraph("<b>Accès</b>", body), Paragraph("Cour arrière, garage libre avant les livraisons.", body)],
                            [Paragraph("<b>Protection</b>", body), Paragraph("Protéger la terrasse avant toute dépose.", body)],
                            [Paragraph("<b>Grutage</b>", body), Paragraph("Zone de stabilisation libre avant 08:00.", body)],
                            [Paragraph("<b>Contact</b>", body), Paragraph("Conducteur de travaux : Nicolas Forny.", body)],
                        ],
                        colWidths=[34 * mm, 131 * mm],
                        style=TableStyle(
                            [
                                ("BOX", (0, 0), (-1, -1), 0.8, HexColor("#AEB4B6")),
                                ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#CFD3D4")),
                                ("BACKGROUND", (0, 0), (0, -1), HexColor("#F0F3F1")),
                                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                                ("TOPPADDING", (0, 0), (-1, -1), 7),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                            ]
                        ),
                    ),
                ]
            ),
            Spacer(1, 9 * mm),
            Paragraph(
                "Ce fichier sert de document de démonstration pour valider l'ouverture directe du devis depuis le module de pointage. Il devra être remplacé par le PDF signé du chantier réel.",
                small,
            ),
        ]
    )

    document.build(story)


if __name__ == "__main__":
    build_pdf()
