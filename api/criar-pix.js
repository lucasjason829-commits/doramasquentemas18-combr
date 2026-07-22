export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { nome, email, telefone, cpf, bump1, bump2 } = req.body;

  if (!nome || !email || !cpf) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const PRECO_BASE = 9.90;
  const PRECO_BUMP = 4.97;
  let total = PRECO_BASE;
  if (bump1) total += PRECO_BUMP;
  if (bump2) total += PRECO_BUMP;
  total = parseFloat(total.toFixed(2));

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': `${cpf}-${Date.now()}`
      },
      body: JSON.stringify({
        transaction_amount: total,
        description: 'Método Máquina de Prazer',
        payment_method_id: 'pix',
        payer: {
          email: email,
          first_name: nome.split(' ')[0],
          last_name: nome.split(' ').slice(1).join(' ') || nome.split(' ')[0],
          identification: {
            type: 'CPF',
            number: cpf
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro Mercado Pago:', data);
      return res.status(400).json({ error: data.message || 'Erro ao gerar PIX' });
    }

    const pixData = data.point_of_interaction?.transaction_data;

    return res.status(200).json({
      id: data.id,
      qr_code: pixData?.qr_code,
      qr_code_base64: pixData?.qr_code_base64
    });

  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({ error: 'Erro interno ao gerar PIX' });
  }
}
