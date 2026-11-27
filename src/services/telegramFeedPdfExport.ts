import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  RelevanceScorableFeedItem,
  StructuredLegalFeedDocument,
  buildStructuredLegalFeedDocument,
} from './telegramFeedUtils';

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  Object.assign(el.style, styles);
  if (typeof text === 'string') {
    el.textContent = text;
  }
  return el;
}

function buildStructuredLegalPrintNode(
  docData: StructuredLegalFeedDocument,
  lang: string,
): HTMLDivElement {
  const isAm = lang.startsWith('am');
  const isEn = lang.startsWith('en');

  const root = createEl('div', {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '794px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontFamily: "'Inter', 'Noto Sans Ethiopic', 'Segoe UI', Arial, sans-serif",
    padding: '36px 42px',
    boxSizing: 'border-box',
    lineHeight: '1.55',
  });

  // Top Header Banner
  const header = createEl('div', {
    borderBottom: '3px double #1e293b',
    paddingBottom: '14px',
    marginBottom: '18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  });

  const brandBlock = createEl('div', {});
  brandBlock.appendChild(
    createEl(
      'div',
      {
        fontSize: '18px',
        fontWeight: '800',
        letterSpacing: '0.06em',
        color: '#0f172a',
      },
      'SEERAAI PRO • ETHIOPIAN LEGAL ARCHIVE',
    ),
  );
  brandBlock.appendChild(
    createEl(
      'div',
      {
        fontSize: '11px',
        fontWeight: '600',
        color: '#475569',
        marginTop: '3px',
      },
      isAm
        ? 'የተደራጀ የሕግና የፍርድ ውሳኔ ሰነድ (Structured Legal Case Record)'
        : isEn
          ? 'Structured Legal Briefing & Case Record'
          : 'Sanada Seeraa fi Murtii Qindaa’e (Structured Legal Record)',
    ),
  );

  const typeBadge = createEl(
    'div',
    {
      backgroundColor: '#eef2ff',
      border: '1px solid #818cf8',
      color: '#312e81',
      borderRadius: '6px',
      padding: '5px 10px',
      fontSize: '10px',
      fontWeight: '700',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    },
    docData.documentType,
  );

  header.appendChild(brandBlock);
  header.appendChild(typeBadge);
  root.appendChild(header);

  // Document Title
  root.appendChild(
    createEl(
      'h1',
      {
        fontSize: '17px',
        fontWeight: '800',
        color: '#0f172a',
        margin: '0 0 14px 0',
        lineHeight: '1.35',
      },
      docData.title,
    ),
  );

  // Structured Metadata Table
  const metaTable = createEl('div', {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px 14px',
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '18px',
    fontSize: '11px',
  });

  const metaEntries: Array<[string, string]> = [
    [
      isAm ? 'የመዝገብ / አዋጅ ቁጥር' : isEn ? 'Case / Reference No.' : 'Lakk. Galmee / Labsii',
      docData.referenceNumber,
    ],
    [
      isAm ? 'ምድብ' : isEn ? 'Category' : 'Kutaa Seeraa',
      docData.categoryLabel,
    ],
    [
      isAm ? 'የታተመበት ቀን' : isEn ? 'Published Date' : 'Guyyaa Maxxansaa',
      docData.publishedDateLabel,
    ],
    [
      isAm ? 'ወደ PDF የተላከበት ቀን' : isEn ? 'Exported On' : 'Guyyaa Export Ta’e',
      docData.exportedAtLabel,
    ],
    [
      isAm ? 'ምንጭ (Telegram)' : isEn ? 'Source Channel' : 'Madda Telegram',
      docData.sourceChannel,
    ],
    [
      isAm ? 'ዋና ሊንክ' : isEn ? 'Direct Source URL' : 'Linkii Maddaa',
      docData.sourceUrl,
    ],
  ];

  for (const [label, value] of metaEntries) {
    const cell = createEl('div', { wordBreak: 'break-word' });
    cell.appendChild(
      createEl(
        'div',
        { fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
        label,
      ),
    );
    cell.appendChild(
      createEl('div', { fontSize: '11px', fontWeight: '600', color: '#1e293b', marginTop: '2px' }, value),
    );
    metaTable.appendChild(cell);
  }
  root.appendChild(metaTable);

  // Key Articles / Citations section
  if (docData.keyArticles.length > 0) {
    const artBox = createEl('div', {
      backgroundColor: '#fffbeb',
      border: '1px solid #fcd34d',
      borderRadius: '8px',
      padding: '10px 14px',
      marginBottom: '16px',
    });
    artBox.appendChild(
      createEl(
        'div',
        { fontSize: '10px', fontWeight: '800', color: '#92400e', textTransform: 'uppercase', marginBottom: '4px' },
        isAm ? 'ዋና ዋና የተጠቀሱ አንቀጾች' : isEn ? 'Cited Provisions & Key Articles' : 'Keeyyattoota fi Wabiiwwan Ijoo',
      ),
    );
    artBox.appendChild(
      createEl('div', { fontSize: '11px', fontWeight: '600', color: '#78350f' }, docData.keyArticles.join('  •  ')),
    );
    root.appendChild(artBox);
  }

  // Main Structured Content
  const bodySection = createEl('div', {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '16px 18px',
    marginBottom: '18px',
    backgroundColor: '#ffffff',
  });
  bodySection.appendChild(
    createEl(
      'div',
      {
        fontSize: '10px',
        fontWeight: '800',
        color: '#334155',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '6px',
        marginBottom: '10px',
      },
      isAm ? 'ዝርዝር የሕግ ይዘት' : isEn ? 'Case Update & Legal Summary' : 'Qabiyyee Guutuu fi Xiinxala',
    ),
  );

  for (const para of docData.bodyParagraphs) {
    bodySection.appendChild(
      createEl(
        'p',
        {
          fontSize: '12px',
          color: '#1e293b',
          margin: '0 0 10px 0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        },
        para,
      ),
    );
  }
  root.appendChild(bodySection);

  // Tags & Legal Verification Footer Note
  if (docData.tags.length > 0) {
    root.appendChild(
      createEl(
        'div',
        { fontSize: '10px', color: '#475569', marginBottom: '12px' },
        `Tags: ${docData.tags.map((t) => `#${t.replace(/^#/, '')}`).join('   ')}`,
      ),
    );
  }

  const noticeBox = createEl('div', {
    borderTop: '1px solid #cbd5e1',
    paddingTop: '10px',
    fontSize: '9.5px',
    color: '#64748b',
  });
  noticeBox.textContent = isAm
    ? 'ማሳሰቢያ፡ ይህ ሰነድ ከSEERAAI PRO (@seeraai_ethio) የቴሌግራም መረጃ ቋት የተወሰደ ነው። ለመደበኛ የፍርድ ቤት ክርክር ዋናውን ነጋሪት ጋዜጣ ወይም የፍርድ ቤት መዝገብ ያረጋግጡ።'
    : isEn
      ? 'Verification Notice: Exported from the SEERAAI PRO Telegram Legal Feed (@seeraai_ethio). Verify against official Negarit Gazeta or certified court records before formal filing.'
      : 'Hubachiisa Mirkaneeffannaa: Sanadni kun maxxansa Telegram SEERAAI PRO (@seeraai_ethio) irraa qophaa’e. Dhimma mana murtii idileef madda Negarit Gazeta ykn galmee mana murtii mirkanaa’e wajjin wal-bira qabaa mirkaneeffadhaa.';
  root.appendChild(noticeBox);

  return root;
}

export async function exportTelegramFeedItemToPdf(
  item: RelevanceScorableFeedItem,
  lang: string = 'om',
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('PDF export requires a browser environment.');
  }

  const docData = buildStructuredLegalFeedDocument(item, lang);
  const container = buildStructuredLegalPrintNode(docData, String(lang || 'om').toLowerCase());
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 10;
    const marginY = 10;
    const printableWidth = pageWidth - marginX * 2;
    const printableHeight = pageHeight - marginY * 2 - 8;

    const canvasPageHeight = Math.max(1, Math.floor((canvas.width * printableHeight) / printableWidth));
    const totalPages = Math.max(1, Math.ceil(canvas.height / canvasPageHeight));

    let currentTop = 0;
    let pageIndex = 0;

    while (currentTop < canvas.height) {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      const sliceHeight = Math.min(canvasPageHeight, canvas.height - currentTop);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          currentTop,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );

        const imgData = pageCanvas.toDataURL('image/png');
        const sliceHeightMm = (sliceHeight * printableWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', marginX, marginY, printableWidth, sliceHeightMm, undefined, 'FAST');
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.2);
      pdf.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);

      const footerLeft = 'SEERAAI PRO • Telegram Legal Brief (@seeraai_ethio)';
      const footerRight = `Page ${pageIndex + 1} of ${totalPages}`;
      pdf.text(footerLeft, marginX, pageHeight - 8);
      pdf.text(footerRight, pageWidth - marginX - pdf.getTextWidth(footerRight), pageHeight - 8);

      currentTop += sliceHeight;
      pageIndex++;
    }

    pdf.save(docData.filename);
    return docData.filename;
  } finally {
    container.remove();
  }
}
