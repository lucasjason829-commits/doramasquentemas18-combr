export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { nome, email, celular, cpf, desconto, bumps } = req.body;

  if (!nome || !email || !cpf) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const PRECO_BASE = 17.00;
  const DESCONTO_PCT = 20;
  const BUMP_TIERS = [7.90, 6.90];

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  let precoBase = PRECO_BASE;
  if (desconto) {
    precoBase = precoBase * (1 - DESCONTO_PCT / 100);
  }
  precoBase = round2(precoBase);

  const listaBumps = Array.isArray(bumps) ? bumps : [];
  const qtdBumps = listaBumps.length;
  let precoBumps = 0;
  if (qtdBumps > 0) {
    const idx = Math.min(qtdBumps, BUMP_TIERS.length) - 1;
    const unit = BUMP_TIERS[idx];
    precoBumps = round2(unit * qtdBumps);
  }

  const total = round2(precoBase + precoBumps);

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
        description: '1200 Doramas Adultos',
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

    if (!pixData?.qr_code) {
      console.error('Resposta sem QR code:', data);
      return res.status(400).json({ error: 'Não foi possível gerar o QR code do PIX' });
    }

    return res.status(200).json({
      payment_id: data.id,
      valor: total,
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64
    });

  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({ error: 'Erro interno ao gerar PIX' });
  }
}
