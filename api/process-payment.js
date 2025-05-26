// Importar o SDK do Mercado Pago no topo
import { MercadoPagoConfig, Payment } from 'mercadopago';

export default async function handler(req, res) {
    // Headers CORS
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
        console.log('🔥 Iniciando processamento de pagamento...');
        console.log('📝 Body recebido:', req.body);

        const { payment_method_id, payer, transaction_amount } = req.body;

        // Validação básica
        if (!payment_method_id || !payer || !transaction_amount) {
            console.log('❌ Dados obrigatórios ausentes');
            return res.status(400).json({ 
                error: 'Dados obrigatórios ausentes',
                received: { payment_method_id, payer, transaction_amount }
            });
        }

        // Sua credencial do Mercado Pago
        const MP_ACCESS_TOKEN = 'APP_USR-7586214711012079-052523-5bad69684c25c61942721988b9ce9bf6-510034420';

        console.log('🔑 Configurando cliente Mercado Pago...');

        // Configurar cliente
        const client = new MercadoPagoConfig({
            accessToken: MP_ACCESS_TOKEN
        });

        const payment = new Payment(client);

        if (payment_method_id === 'pix') {
            console.log('📱 Processando PIX...');

            // Dados do pagamento PIX
            const paymentData = {
                transaction_amount: Number(transaction_amount),
                description: 'Recurso de Multa - Anula Fácil',
                payment_method_id: 'pix',
                payer: {
                    email: payer.email,
                    first_name: payer.first_name,
                    last_name: payer.last_name,
                    identification: {
                        type: 'CPF',
                        number: payer.identification.number.replace(/[^0-9]/g, '')
                    }
                }
            };

            console.log('📤 Dados para MP:', paymentData);

            // Criar pagamento
            const result = await payment.create({ body: paymentData });

            console.log('📥 Resposta do MP:', result);

            // Preparar resposta
            const response = {
                id: result.id,
                status: result.status,
                payment_method_id: result.payment_method_id
            };

            // Adicionar QR Code se existir
            if (result.point_of_interaction?.transaction_data?.qr_code) {
                response.qr_code = result.point_of_interaction.transaction_data.qr_code;
                response.qr_code_base64 = result.point_of_interaction.transaction_data.qr_code_base64;
                console.log('✅ QR Code gerado!');
            } else {
                console.log('⚠️ QR Code não encontrado na resposta');
            }

            return res.status(200).json(response);

        } else {
            // Outros métodos de pagamento
            console.log('💳 Método não implementado:', payment_method_id);
            return res.status(200).json({
                id: 'test_' + Date.now(),
                status: 'pending',
                payment_method_id: payment_method_id,
                message: 'Método simulado para teste'
            });
        }

    } catch (error) {
        console.error('💥 ERRO COMPLETO:', error);
        console.error('📊 Stack:', error.stack);
        
        // Log específico para erros do MP
        if (error.cause) {
            console.error('🔴 Erros do Mercado Pago:', error.cause);
        }

        return res.status(500).json({
            error: 'Erro interno do servidor',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}