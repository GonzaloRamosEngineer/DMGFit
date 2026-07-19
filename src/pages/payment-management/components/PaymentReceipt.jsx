import React from 'react';
import Icon from '../../../components/AppIcon';

// Comprobante NO fiscal. Marca VC Fit. Permite imprimir / guardar PDF (vía diálogo de
// impresión) y compartir por WhatsApp (wa.me con texto prearmado).

const GYM_NAME = 'VC Fit';
const BRAND = '#FF4444';

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
    .format(Number(n || 0));

const parseLocalDate = (s) => {
  if (!s) return null;
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const fmtDate = (s) => {
  const dt = parseLocalDate(s);
  return dt ? dt.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
};

const methodLabel = (m) => {
  const k = String(m || '').toLowerCase();
  if (k === 'efectivo') return 'Efectivo';
  if (k === 'tarjeta') return 'Tarjeta';
  if (k === 'transferencia') return 'Transferencia';
  if (k === 'mp' || k === 'mercadopago') return 'Mercado Pago';
  return m || '—';
};

const receiptNumber = (id) => (id ? `#${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}` : '#—');

const discountLine = (payment) => {
  const val = Number(payment.discount_value || 0);
  if (!val) return null;
  const base = Number(payment.base_amount || payment.amount || 0);
  const off = payment.discount_type === 'percent' ? base * (val / 100) : val;
  const label = payment.discount_type === 'percent' ? `${val}%` : fmtARS(val);
  return { off, label };
};

const buildReceiptHTML = (payment) => {
  const disc = discountLine(payment);
  const base = Number(payment.base_amount || payment.amount || 0);
  const rows = [
    ['Atleta', payment.athleteName || '—'],
    ['Concepto', payment.concept || 'Pago'],
    ['Método', methodLabel(payment.method)],
    ['Fecha', fmtDate(payment.payment_date)],
  ];
  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#666;font-size:12px;">${k}</td><td style="padding:6px 0;text-align:right;font-weight:700;font-size:13px;">${v}</td></tr>`
    )
    .join('');

  const totalsHtml = disc
    ? `<tr><td style="padding:4px 0;color:#666;font-size:12px;">Monto base</td><td style="padding:4px 0;text-align:right;font-size:13px;">${fmtARS(base)}</td></tr>
       <tr><td style="padding:4px 0;color:#666;font-size:12px;">Descuento (${disc.label})</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#0a0;">-${fmtARS(disc.off)}</td></tr>`
    : '';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
  <title>Comprobante ${receiptNumber(payment.id)} - ${GYM_NAME}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;}
    body{background:#f4f4f5;padding:24px;color:#111;}
    .card{max-width:380px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);}
    .head{background:${BRAND};color:#fff;padding:20px 24px;}
    .head h1{font-size:22px;font-weight:900;letter-spacing:-.5px;}
    .head p{font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:.9;margin-top:2px;}
    .body{padding:24px;}
    .num{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
    .num span{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;}
    .num b{font-size:13px;font-weight:800;}
    table{width:100%;border-collapse:collapse;}
    .total{border-top:2px solid #eee;margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;align-items:baseline;}
    .total .l{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#666;}
    .total .v{font-size:26px;font-weight:900;color:${BRAND};}
    .legend{margin-top:18px;padding-top:14px;border-top:1px dashed #ddd;font-size:10px;color:#999;text-align:center;line-height:1.5;}
    @media print{body{background:#fff;padding:0;}.card{box-shadow:none;max-width:none;}}
  </style></head>
  <body>
    <div class="card">
      <div class="head"><h1>${GYM_NAME}</h1><p>Comprobante de pago</p></div>
      <div class="body">
        <div class="num"><span>Comprobante</span><b>${receiptNumber(payment.id)}</b></div>
        <table>${rowsHtml}${totalsHtml}</table>
        <div class="total"><span class="l">Total pagado</span><span class="v">${fmtARS(payment.amount)}</span></div>
        <div class="legend">Comprobante interno no válido como factura.<br/>Gracias por entrenar en ${GYM_NAME}.</div>
      </div>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print();},150);};</script>
  </body></html>`;
};

const buildWhatsAppText = (payment) => {
  const lines = [
    `Hola ${payment.athleteName || ''} 👋`.trim(),
    '',
    `Recibimos tu pago en *${GYM_NAME}*:`,
    '',
    `📋 ${payment.concept || 'Pago'}`,
    `💵 ${fmtARS(payment.amount)}`,
    `📅 ${fmtDate(payment.payment_date)}`,
    `💳 ${methodLabel(payment.method)}`,
    '',
    `Comprobante ${receiptNumber(payment.id)}`,
    '¡Gracias! 💪',
  ];
  return lines.join('\n');
};

const PaymentReceipt = ({ payment, athletePhone, onClose }) => {
  if (!payment) return null;

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=420,height=680');
    if (!w) return; // popup bloqueado
    w.document.write(buildReceiptHTML(payment));
    w.document.close();
    w.focus();
  };

  const handleWhatsApp = () => {
    const digits = String(athletePhone || '').replace(/\D/g, '');
    const text = encodeURIComponent(buildWhatsAppText(payment));
    const url = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener');
  };

  const disc = discountLine(payment);
  const base = Number(payment.base_amount || payment.amount || 0);

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="bg-card w-full max-w-sm rounded-[1.5rem] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Preview del comprobante */}
        <div className="bg-primary text-primary-foreground px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">{GYM_NAME}</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-90">Comprobante de pago</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/15 rounded-full transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Comprobante</span>
            <span className="text-sm font-black text-text-primary">{receiptNumber(payment.id)}</span>
          </div>

          <div className="space-y-2 text-sm">
            {[
              ['Atleta', payment.athleteName || '—'],
              ['Concepto', payment.concept || 'Pago'],
              ['Método', methodLabel(payment.method)],
              ['Fecha', fmtDate(payment.payment_date)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <span className="text-text-tertiary">{k}</span>
                <span className="font-bold text-text-secondary text-right">{v}</span>
              </div>
            ))}
          </div>

          {disc && (
            <div className="pt-2 border-t border-border space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-text-tertiary">Monto base</span><span className="text-text-secondary">{fmtARS(base)}</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Descuento ({disc.label})</span><span className="text-success">-{fmtARS(disc.off)}</span></div>
            </div>
          )}

          <div className="pt-3 border-t-2 border-border flex justify-between items-baseline">
            <span className="text-xs font-black text-text-secondary uppercase tracking-wide">Total pagado</span>
            <span className="text-2xl font-black text-primary">{fmtARS(payment.amount)}</span>
          </div>

          <p className="text-[10px] text-text-tertiary text-center pt-2 leading-relaxed">
            Comprobante interno no válido como factura.
          </p>
        </div>

        {/* Acciones */}
        <div className="px-6 py-4 border-t border-border bg-muted/50 flex items-center gap-2">
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-success text-success-foreground text-xs font-black uppercase tracking-widest hover:bg-success/90 transition-colors"
          >
            <Icon name="MessageCircle" size={16} /> WhatsApp
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-text-secondary text-xs font-black uppercase tracking-widest hover:bg-muted transition-colors"
          >
            <Icon name="Printer" size={16} /> Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentReceipt;
