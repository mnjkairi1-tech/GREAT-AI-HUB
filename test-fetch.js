fetch('http://localhost:3000/api/gemini/generate-menu-item', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ itemName: 'Head Massage', price: '60', businessType: 'Salon' })
}).then(res => res.text().then(text => console.log('Status:', res.status, 'Body:', text))).catch(console.error);
