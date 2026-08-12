import { describe, expect, it } from 'vitest';

import {
  RECEIPT_ASSETS,
  renderReceiptDocument,
  resolveStatusTone,
  splitAmount,
  type ReceiptDocumentData,
} from '@/shared/ui/receipt-document';
import { receiptDocumentFromLines } from '@/shared/ui/receipt';
import { formatReceiptAmount, type ReceiptLine } from '@/shared/ui/receipt-format';

const MEMBERSHIP_LINES: ReceiptLine[] = [
  ['Comercio', 'ASI Rep. Dominicana'],
  ['No. de orden', 'ASI-260810-741f70da'],
  ['Tipo', 'Membresía inicial'],
  ['Categoría', 'Profesional'],
  ['Monto', 'RD$2,500.00'],
  ['Término', '1 año'],
  ['Vigencia', '09 de agosto de 2026 — 09 de agosto de 2027'],
  ['Resultado', 'Aprobado'],
  ['No. de autorización', 'OK0410'],
  ['Referencia', '2026081001595844936406'],
  ['Fecha', '10 de agosto de 2026'],
];

const SAMPLE: ReceiptDocumentData = {
  eyebrow: 'Membresía',
  titulo: 'Comprobante de pago de membresía',
  estado: 'Aprobado',
  moneda: 'RD$',
  monto: '2,500.00',
  noOrden: 'ASI-260810-741f70da',
  fecha: '10 de agosto de 2026',
  detalle: [
    ['Comercio', 'ASI Rep. Dominicana'],
    ['No. de autorización', 'OK0410'],
  ],
  procesador: 'AZUL',
  fechaGeneracion: '10 de agosto de 2026',
  horaGeneracion: '4:05 p. m.',
};

describe('splitAmount', () => {
  it('separa el prefijo de moneda del monto', () => {
    expect(splitAmount('RD$2,500.00')).toEqual({
      moneda: 'RD$',
      monto: '2,500.00',
    });
    expect(splitAmount('USD 1,000.00')).toEqual({
      moneda: 'USD',
      monto: '1,000.00',
    });
  });

  it('tolera un monto sin moneda', () => {
    expect(splitAmount('2,500.00')).toEqual({ moneda: '', monto: '2,500.00' });
  });
});

describe('formatReceiptAmount', () => {
  it('usa RD$ para DOP y siempre dos decimales', () => {
    expect(formatReceiptAmount(2500, 'DOP')).toBe('RD$2,500.00');
    expect(formatReceiptAmount(1000, 'USD')).toBe('USD 1,000.00');
  });
});

describe('resolveStatusTone', () => {
  it('solo colorea el aprobado; el resto va al tono neutro', () => {
    expect(resolveStatusTone('Aprobado')).toBe('aprobado');
    expect(resolveStatusTone('verified')).toBe('aprobado');
    expect(resolveStatusTone('Rechazada')).toBe('neutro');
    expect(resolveStatusTone('pending')).toBe('neutro');
  });
});

describe('renderReceiptDocument', () => {
  const html = renderReceiptDocument(SAMPLE, 'https://asi.do');

  it('no deja marcadores sin resolver', () => {
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('respeta la geometría de una hoja Carta sin márgenes', () => {
    expect(html).toContain('@page { size: letter; margin: 0; }');
    expect(html).toContain('width: 8.5in');
    expect(html).toContain('height: 11in');
    expect(html).toContain('print-color-adjust: exact');
  });

  it('apunta al logo y a las fuentes de marca servidos por la app', () => {
    expect(html).toContain(`https://asi.do${RECEIPT_ASSETS.logo}`);
    expect(html).toContain(`https://asi.do${RECEIPT_ASSETS.fonts.extraBold}`);
    expect(html).toContain("font-family: 'Joanna Sans Nova'");
  });

  it('pinta el badge con el trío de color del estado', () => {
    expect(html).toContain('--status-bg: #eaf6ee;');
    expect(html).toContain('--status-ink: #22684a;');
    expect(renderReceiptDocument({ ...SAMPLE, estado: 'Rechazado' })).toContain(
      '--status-bg: #f4f6fa;'
    );
  });

  it('separa moneda y monto y marca los valores numéricos', () => {
    expect(html).toContain('<span class="amount-cur">RD$</span>');
    expect(html).toContain('<span class="amount-val">2,500.00</span>');
    expect(html).toContain('<span class="row-value num">OK0410</span>');
    expect(html).toContain('<span class="row-value">ASI Rep. Dominicana</span>');
  });

  it('mantiene junta la hora en convención dominicana', () => {
    expect(html).toContain('4:05 p.&nbsp;m.');
  });

  it('escapa el contenido inyectado', () => {
    const hostile = renderReceiptDocument({
      ...SAMPLE,
      noOrden: '<script>alert(1)</script>',
    });
    expect(hostile).not.toContain('<script>alert(1)</script>');
    expect(hostile).toContain('&lt;script&gt;');
  });
});

describe('receiptDocumentFromLines', () => {
  const data = receiptDocumentFromLines(
    'Comprobante de pago de membresía',
    MEMBERSHIP_LINES,
    { eyebrow: 'Membresía', now: new Date('2026-08-10T20:05:00Z') }
  );

  it('eleva monto, estado, orden y fecha fuera del detalle', () => {
    expect(data.moneda).toBe('RD$');
    expect(data.monto).toBe('2,500.00');
    expect(data.estado).toBe('Aprobado');
    expect(data.noOrden).toBe('ASI-260810-741f70da');
    expect(data.fecha).toBe('10 de agosto de 2026');
  });

  it('deja exactamente las siete filas del diseño, en orden', () => {
    expect(data.detalle.map(([label]) => label)).toEqual([
      'Comercio',
      'Tipo',
      'Categoría',
      'Término',
      'Vigencia',
      'No. de autorización',
      'Referencia',
    ]);
  });

  it('cabe en una sola hoja con las siete filas del diseño', () => {
    // El espaciador flexible es lo único que absorbe filas extra; si el detalle
    // crece por encima de 10 filas hay que revisar la geometría a mano.
    expect(data.detalle.length).toBeLessThanOrEqual(10);
  });

  it('usa AZUL como procesador por defecto', () => {
    expect(data.procesador).toBe('AZUL');
  });
});
