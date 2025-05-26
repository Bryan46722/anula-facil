export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        console.log('🔍 Dados recebidos:', JSON.stringify(req.body, null, 2));
        console.log('🔑 MP_ACCESS_TOKEN existe?', !!process.env.MP_ACCESS_TOKEN);
        console.log('🔑 MP_PUBLIC_KEY existe?', !!process.env.MP_PUBLIC_KEY);

        const { payment_method_id, payer, transaction_amount } = req.body;

        console.log('💰 Método de pagamento:', payment_method_id);
        console.log('👤 Dados do pagador:', payer);
        console.log('💵 Valor:', transaction_amount);

        if (payment_method_id === 'pix') {
            console.log('📱 Processando PIX...');
            
            // Se não tem as credenciais, simular PIX
            if (!process.env.MP_ACCESS_TOKEN) {
                console.log('⚠️ Credenciais não encontradas - simulando PIX');
                return res.status(200).json({
                    id: 'pix_simulado_' + Date.now(),
                    status: 'pending',
                    payment_method_id: 'pix',
                    qr_code: '00020101021226580014br.gov.bcb.pix2536pix.example.com/qr/v2/cobv/9d36b84f-c70f-6204-ab57-77example',
                    qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAeFBMVEX///8AAAD7+/sEBAQICAj39/fz8/Pw8PDt7e3q6uro6Ojl5eXi4uLf39/c3Nz29vbT09PQ0NDNzc3Kysnb29vGxsYgICC+vr48PDw1NTUtLS0pKSkcHBwUFBQQEBA='
                });
            }

            // Tentar usar Mercado Pago real
            const { MercadoPagoConfig, Payment } = await import('mercadopago');
            
            const client = new MercadoPagoConfig({
                accessToken: process.env.MP_ACCESS_TOKEN
            });

            const payment = new Payment(client);

            const paymentData = {
                transaction_amount: parseFloat(transaction_amount),
                description: 'Recurso de Multa - Anula Fácil',
                payment_method_id: 'pix',
                payer: {
                    email: payer.email,
                    first_name: payer.first_name,
                    last_name: payer.last_name,
                    identification: {
                        type: payer.identification.type,
                        number: payer.identification.number
                    }
                },
                date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            };

            console.log('📤 Enviando para MP:', JSON.stringify(paymentData, null, 2));

            const paymentResponse = await payment.create({ body: paymentData });
            
            console.log('📥 Resposta do MP:', JSON.stringify(paymentResponse, null, 2));

            const response = {
                id: paymentResponse.id,
                status: paymentResponse.status,
                status_detail: paymentResponse.status_detail,
                payment_method_id: paymentResponse.payment_method_id
            };

            if (paymentResponse.point_of_interaction) {
                response.qr_code = paymentResponse.point_of_interaction.transaction_data.qr_code;
                response.qr_code_base64 = paymentResponse.point_of_interaction.transaction_data.qr_code_base64;
                console.log('✅ QR Code gerado!');
            } else {
                console.log('❌ Sem QR Code na resposta');
            }

            return res.status(200).json(response);

        } else {
            // Outros métodos
            return res.status(200).json({
                id: 'simulado_' + Date.now(),
                status: 'approved',
                payment_method_id: payment_method_id
            });
        }

    } catch (error) {
        console.error('💥 Erro completo:', error);
        res.status(500).json({ 
            error: 'Erro no servidor',
            details: error.message,
            stack: error.stack
        });
    }
}