import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || 'APP_USR-7586214711012079-052523-5bad69684c25c61942721988b9ce9bf6-510034420',
    options: {
        timeout: 30000,
        // Forçar produção se token for de produção
        sandbox: false
    }
});

const payment = new Payment(client);

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
        console.log('🚀 Iniciando criação de pagamento...');
        console.log('📥 Dados recebidos:', JSON.stringify(req.body, null, 2));

        const { payment_method_id, payer, transaction_amount, plan, description } = req.body;

        // Validações básicas
        if (!payment_method_id || !payer || !transaction_amount) {
            return res.status(400).json({ 
                error: 'Dados obrigatórios não informados',
                required: ['payment_method_id', 'payer', 'transaction_amount']
            });
        }

        // Limpar CPF
        const cpfLimpo = payer.identification.number.replace(/[^0-9]/g, '');
        
        // Montar dados do pagamento
        const paymentData = {
            transaction_amount: parseFloat(transaction_amount),
            description: description || 'Anula Fácil - Recurso de Multa',
            payment_method_id: payment_method_id,
            payer: {
                email: payer.email,
                first_name: payer.first_name,
                last_name: payer.last_name,
                identification: {
                    type: 'CPF',
                    number: cpfLimpo
                }
            },
            external_reference: `AF_${plan || 'individual'}_${Date.now()}`,
            notification_url: `https://anulafacil.online/api/webhook`,
            // Configurações específicas para PIX
            ...(payment_method_id === 'pix' && {
                date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
                additional_info: {
                    items: [{
                        id: `anula_facil_${plan || 'individual'}`,
                        title: description || 'Recurso de Multa',
                        description: 'Serviço de recurso de multa de trânsito',
                        quantity: 1,
                        unit_price: parseFloat(transaction_amount)
                    }],
                    payer: {
                        first_name: payer.first_name,
                        last_name: payer.last_name,
                        phone: {
                            area_code: '11',
                            number: '999999999'
                        }
                    }
                }
            })
        };

        console.log('📤 Enviando para Mercado Pago:', JSON.stringify(paymentData, null, 2));

        // Criar pagamento
        const result = await payment.create({ body: paymentData });

        console.log('📥 Resposta do Mercado Pago:', JSON.stringify(result, null, 2));

        // Processar resposta baseada no método de pagamento
        if (payment_method_id === 'pix') {
            return handlePixResponse(result, res);
        } else if (payment_method_id === 'bolbradesco') {
            return handleTicketResponse(result, res);
        } else {
            return handleCardResponse(result, res);
        }

    } catch (error) {
        console.error('💥 Erro ao processar pagamento:', error);
        console.error('📊 Stack:', error.stack);
        
        if (error.cause) {
            console.error('🔴 Detalhes do erro MP:', error.cause);
            return res.status(400).json({
                error: 'Erro do Mercado Pago',
                details: error.cause,
                message: error.message
            });
        }

        return res.status(500).json({
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
}

function handlePixResponse(result, res) {
    console.log('🔍 Processando resposta PIX...');
    
    // Procurar QR Code em diferentes locais
    let qrCode = null;
    let qrCodeBase64 = null;

    // Local 1: point_of_interaction.transaction_data
    if (result.point_of_interaction?.transaction_data?.qr_code) {
        qrCode = result.point_of_interaction.transaction_data.qr_code;
        qrCodeBase64 = result.point_of_interaction.transaction_data.qr_code_base64;
        console.log('✅ QR encontrado em point_of_interaction.transaction_data');
    }
    // Local 2: transaction_details
    else if (result.transaction_details?.qr_code) {
        qrCode = result.transaction_details.qr_code;
        console.log('✅ QR encontrado em transaction_details');
    }
    // Local 3: direto no resultado
    else if (result.qr_code) {
        qrCode = result.qr_code;
        console.log('✅ QR encontrado em result.qr_code');
    }

    if (!qrCode) {
        console.log('❌ QR Code não encontrado!');
        console.log('🔍 Estrutura disponível:', Object.keys(result));
        
        return res.status(500).json({
            error: 'QR Code PIX não foi gerado',
            payment_id: result.id,
            status: result.status,
            debug_info: {
                available_keys: Object.keys(result),
                point_of_interaction: result.point_of_interaction,
                transaction_details: result.transaction_details
            }
        });
    }

    // Validar se é PIX válido
    if (!qrCode.startsWith('00020101')) {
        console.log('❌ QR Code não é PIX válido!');
        console.log('🔍 QR Code recebido:', qrCode.substring(0, 100));
        
        return res.status(500).json({
            error: 'QR Code gerado não é PIX válido',
            qr_preview: qrCode.substring(0, 50),
            payment_id: result.id
        });
    }

    console.log('✅ PIX válido gerado!');
    console.log(`📏 Tamanho do QR: ${qrCode.length} caracteres`);

    return res.status(200).json({
        id: result.id,
        status: result.status,
        payment_method_id: result.payment_method_id,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        external_reference: result.external_reference,
        date_created: result.date_created,
        date_of_expiration: result.date_of_expiration,
        transaction_amount: result.transaction_amount,
        is_valid_pix: qrCode.startsWith('00020101'),
        validation: {
            starts_with_pix_format: qrCode.startsWith('00020101'),
            length: qrCode.length,
            has_bcb_reference: qrCode.includes('br.gov.bcb.pix')
        }
    });
}

function handleTicketResponse(result, res) {
    console.log('🧾 Processando resposta Boleto...');
    
    return res.status(200).json({
        id: result.id,
        status: result.status,
        payment_method_id: result.payment_method_id,
        external_reference: result.external_reference,
        date_created: result.date_created,
        transaction_amount: result.transaction_amount,
        ticket_url: result.transaction_details?.external_resource_url
    });
}

function handleCardResponse(result, res) {
    console.log('💳 Processando resposta Cartão...');
    
    return res.status(200).json({
        id: result.id,
        status: result.status,
        status_detail: result.status_detail,
        payment_method_id: result.payment_method_id,
        external_reference: result.external_reference,
        date_created: result.date_created,
        transaction_amount: result.transaction_amount
    });
}