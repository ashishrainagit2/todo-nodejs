const twilio = require('twilio');
const AppError = require('./AppError');

const toE164 = (phone) => {
    const raw = String(phone || '').trim();
    if (!raw) {
        throw new AppError('Phone required', 400, [], 'ERR_VALIDATION');
    }
    if (raw.startsWith('+')) return raw;
    return `${process.env.SMS_COUNTRY_CODE || '+91'}${raw}`;
};

const getClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifySid = process.env.TWILIO_VERIFY_SID;
    if (!accountSid || !authToken || !verifySid) {
        throw new AppError('SMS is not configured', 503, [], 'ERR_SMS');
    }
    return {
        client: twilio(accountSid, authToken),
        verifySid
    };
};

exports.sendSms = async ({ to, text: _text, channel = 'sms' }) => {
    const { client, verifySid } = getClient();
    try {
        await client.verify.v2.services(verifySid).verifications.create({
            to: toE164(to),
            channel
        });
    } catch (e) {
        throw new AppError('SMS send failed', 502, [], 'ERR_SMS');
    }
};

exports.checkSms = async ({ to, code }) => {
    const { client, verifySid } = getClient();
    try {
        const check = await client.verify.v2.services(verifySid).verificationChecks.create({
            to: toE164(to),
            code: String(code)
        });
        return check.status === 'approved';
    } catch (e) {
        throw new AppError('SMS check failed', 502, [], 'ERR_SMS');
    }
};
