import { MercadoPagoConfig, Payment } from 'mercadopago';

// SUAS CREDENCIAIS EXATAS DA IMAGEM
const client = new MercadoPagoConfig({
    accessToken: 'APP_USR-7586214711012079-052523-5bad69684c-25c6f94272198b9ce9bfb6-510034420',
    options: {
        timeout: 30000
    }
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
        console.log('🚀 USANDO CREDENCIAIS EXATAS DA IMAGEM');
        
        const { payment_method_id, payer, transaction_amount, plan, description } = req.body;

        if (payment_method_id === 'pix') {
            const cpfLimpo = payer.identification.number.replace(/[^0-9]/g, '');
            
            const paymentData = {
                transaction_amount: parseFloat(transaction_amount),
                description: description || 'Anula Fácil - Recurso de Multa',
                payment_method_id: 'pix',
                payer: {
                    email: payer.email,
                    first_name: payer.first_name,
                    last_name: payer.last_name,
                    identification: {
                        type: 'CPF',
                        number: cpfLimpo
                    }
                },
                external_reference: `AF_${Date.now()}`,
                notification_url: 'https://anulafacil.online/api/webhook'
            };

            console.log('📤 Dados do pagamento:', JSON.stringify(paymentData, null, 2));

            const result = await payment.create({ body: paymentData });

            console.log('📥 RESPOSTA COMPLETA MP:', JSON.stringify(result, null, 2));

            // BUSCAR QR CODE
            let qrCode = result.point_of_interaction?.transaction_data?.qr_code;
            
            if (!qrCode) {
                console.log('❌ QR não encontrado nos locais usuais');
                console.log('🔍 Estrutura point_of_interaction:', result.point_of_interaction);
                console.log('🔍 Estrutura transaction_details:', result.transaction_details);
                
                return res.status(500).json({
                    error: 'QR Code não encontrado',
                    payment_id: result.id,
                    status: result.status,
                    debug: {
                        point_of_interaction: result.point_of_interaction,
                        transaction_details: result.transaction_details,
                        all_keys: Object.keys(result)
                    }
                });
            }

            console.log('✅ QR CODE ENCONTRADO!');
            console.log(`📏 Tamanho: ${qrCode.length}`);
            console.log(`🔤 Início: ${qrCode.substring(0, 50)}`);

            return res.status(200).json({
                id: result.id,
                status: result.status,
                payment_method_id: result.payment_method_id,
                qr_code: qrCode,
                external_reference: result.external_reference,
                date_created: result.date_created,
                date_of_expiration: result.date_of_expiration,
                transaction_amount: result.transaction_amount
            });
        }

        return res.status(400).json({ error: 'Método não suportado' });

    } catch (error) {
        console.error('💥 ERRO:', error);
        console.error('📊 Detalhes:', error.cause);
        
        return res.status(500).json({
            error: 'Erro ao processar',
            message: error.message,
            cause: error.cause
        });
    }
}