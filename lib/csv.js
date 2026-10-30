const HEADER = ['Picked At', 'Guest Name', 'Gift', 'Category', 'Price (R)', 'Where To Buy', 'Link'];

function cell(value) {
  let s = String(value ?? '');
  // Stop spreadsheet apps from treating a guest's name as a formula
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(picks) {
  const rows = [...picks]
    .sort((a, b) => a.pickedAt.localeCompare(b.pickedAt))
    .map((p) => [p.pickedAt, p.guestName, p.giftName, p.category, p.price, p.retailer, p.url]);
  return [HEADER, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
