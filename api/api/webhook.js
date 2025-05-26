import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

const payment = new Payment(client);

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
        console.log('Webhook recebido:', req.body);

        const { type, data, action } = req.body;

        if (type === 'payment' || action === 'payment.updated') {
            const paymentId = data.id;
            
            console.log(`Consultando pagamento ID: ${paymentId}`);
            
            const paymentInfo = await payment.get({ id: paymentId });
            
            console.log('Status do pagamento:', {
                id: paymentInfo.id,
                status: paymentInfo.status,
                external_reference: paymentInfo.external_reference,
                amount: paymentInfo.transaction_amount
            });

            switch (paymentInfo.status) {
                case 'approved':
                    console.log('✅ Pagamento aprovado!');
                    // Aqui você pode ativar o serviço
                    break;
                case 'pending':
                    console.log('⏳ Pagamento pendente...');
                    break;
                case 'rejected':
                    console.log('❌ Pagamento rejeitado...');
                    break;
            }
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Erro no webhook:', error);
        res.status(200).json({ received: true });
    }
}