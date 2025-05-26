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
        console.log('📝 Body recebido:', JSON.stringify(req.body, null, 2));

        const { payment_method_id, payer, transaction_amount, plan, description } = req.body;

        // Validação básica
        if (!payment_method_id || !payer || !transaction_amount) {
            console.log('❌ Dados obrigatórios ausentes');
            return res.status(400).json({ 
                error: 'Dados obrigatórios ausentes',
                received: { payment_method_id, payer, transaction_amount }
            });
        }

        // Validação do payer
        if (!payer.email || !payer.first_name || !payer.last_name || !payer.identification) {
            console.log('❌ Dados do payer incompletos');
            return res.status(400).json({ 
                error: 'Dados do payer incompletos',
                required: ['email', 'first_name', 'last_name', 'identification']
            });
        }

        // Sua credencial do Mercado Pago
        const MP_ACCESS_TOKEN = 'APP_USR-7586214711012079-052523-5bad69684c25c61942721988b9ce9bf6-510034420';

        console.log('🔑 Configurando cliente Mercado Pago...');

        // Configurar cliente
        const client = new MercadoPagoConfig({
            accessToken: MP_ACCESS_TOKEN,
            options: {
                timeout: 10000,
                idempotencyKey: `anula_facil_${Date.now()}_${Math.random()}`
            }
        });

        const payment = new Payment(client);

        if (payment_method_id === 'pix') {
            console.log('📱 Processando PIX...');

            // Limpar CPF
            const cleanCpf = payer.identification.number.replace(/[^0-9]/g, '');
            
            if (cleanCpf.length !== 11) {
                return res.status(400).json({ 
                    error: 'CPF inválido',
                    received_cpf_length: cleanCpf.length
                });
            }

            // Dados do pagamento PIX
            const paymentData = {
                transaction_amount: Number(transaction_amount),
                description: description || `Recurso de Multa - Anula Fácil - ${plan || 'Individual'}`,
                payment_method_id: 'pix',
                payer: {
                    email: String(payer.email).trim(),
                    first_name: String(payer.first_name).trim(),
                    last_name: String(payer.last_name).trim(),
                    identification: {
                        type: 'CPF',
                        number: cleanCpf
                    }
                },
                external_reference: `anula_facil_${plan || 'individual'}_${Date.now()}`,
                date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            };

            console.log('📤 Dados para MP:', JSON.stringify(paymentData, null, 2));

            // Criar pagamento
            const result = await payment.create({ body: paymentData });

            console.log('📥 Resposta do MP:', JSON.stringify(result, null, 2));

            // Preparar resposta
            const response = {
                id: result.id,
                status: result.status,
                payment_method_id: result.payment_method_id,
                external_reference: result.external_reference,
                date_created: result.date_created,
                date_of_expiration: result.date_of_expiration
            };

            // Adicionar QR Code se existir
            if (result.point_of_interaction?.transaction_data?.qr_code) {
                response.qr_code = result.point_of_interaction.transaction_data.qr_code;
                response.qr_code_base64 = result.point_of_interaction.transaction_data.qr_code_base64;
                console.log('✅ QR Code gerado! Tamanho:', response.qr_code.length);
            } else {
                console.log('⚠️ QR Code não encontrado na resposta');
                console.log('🔍 Estrutura point_of_interaction:', result.point_of_interaction);
            }

            return res.status(200).json(response);

        } else if (payment_method_id === 'bolbradesco') {
            console.log('🎫 Processando Boleto...');

            const paymentData = {
                transaction_amount: Number(transaction_amount),
                description: description || `Recurso de Multa - Anula Fácil - ${plan || 'Individual'}`,
                payment_method_id: 'bolbradesco',
                payer: {
                    email: String(payer.email).trim(),
                    first_name: String(payer.first_name).trim(),
                    last_name: String(payer.last_name).trim(),
                    identification: {
                        type: 'CPF',
                        number: payer.identification.number.replace(/[^0-9]/g, '')
                    }
                },
                external_reference: `anula_facil_boleto_${plan || 'individual'}_${Date.now()}`,
                date_of_expiration: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
            };

            const result = await payment.create({ body: paymentData });

            const response = {
                id: result.id,
                status: result.status,
                payment_method_id: result.payment_method_id,
                external_reference: result.external_reference,
                date_created: result.date_created,
                date_of_expiration: result.date_of_expiration
            };

            if (result.transaction_details?.external_resource_url) {
                response.ticket_url = result.transaction_details.external_resource_url;
                console.log('✅ URL do boleto gerada!');
            }

            return res.status(200).json(response);

        } else {
            // Outros métodos de pagamento
            console.log('💳 Método não implementado:', payment_method_id);
            return res.status(400).json({
                error: 'Método de pagamento não suportado',
                supported_methods: ['pix', 'bolbradesco'],
                received: payment_method_id
            });
        }

    } catch (error) {
        console.error('💥 ERRO COMPLETO:', error);
        console.error('📊 Stack:', error.stack);
        console.error('📋 Name:', error.name);
        console.error('📝 Message:', error.message);
        
        // Log específico para erros do MP
        if (error.cause && Array.isArray(error.cause)) {
            console.error('🔴 Erros do Mercado Pago:', error.cause);
            return res.status(400).json({
                error: 'Erro de validação do Mercado Pago',
                details: error.cause.map(err => ({
                    code: err.code,
                    description: err.description
                }))
            });
        }

        return res.status(500).json({
            error: 'Erro interno do servidor',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}