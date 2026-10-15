import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://hlkprapotgvtmqqnwddx.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_PXjojb0c7TTWSwM_U2W-0Q_5ACU8V07';

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SERVICE_ROLE_KEY ||
  '';

function getSupabaseClient(authHeader?: string) {
  if (SUPABASE_SERVICE_ROLE_KEY) {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  if (authHeader) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

const isUuid = (val?: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || '');

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const supabase = getSupabaseClient(req.headers.authorization);
    const {
      bottleId,
      quantityUsed,
      unit,
      userId,
      userName,
      chemicalId,
      chemicalName,
      purpose,
      project,
      notes,
    } = req.body || {};

    if (!bottleId) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã ID của chai cần sử dụng.' });
    }

    const numQty = parseFloat(quantityUsed);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ success: false, message: 'Số lượng sử dụng phải lớn hơn 0.' });
    }

    // 1. Fetch fresh bottle row from Supabase
    let bottleQuery = supabase.from('bottles').select('*');
    if (isUuid(bottleId)) {
      bottleQuery = bottleQuery.eq('id', bottleId);
    } else {
      bottleQuery = bottleQuery.or(`id.eq.${bottleId},bottle_code.eq.${bottleId},qr_code.eq.${bottleId}`);
    }

    const { data: currentBottle, error: fetchErr } = await bottleQuery.maybeSingle();

    if (fetchErr || !currentBottle) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chai hóa chất trong cơ sở dữ liệu.' });
    }

    if (currentBottle.status === 'EMPTY' || currentBottle.status === 'DISPOSED' || currentBottle.status === 'DELETED') {
      return res.status(400).json({
        success: false,
        message: `Chai ${currentBottle.bottle_code} hiện không còn khả dụng (Trạng thái: ${currentBottle.status}).`,
      });
    }

    const prevQty = Number(currentBottle.current_quantity) || 0;
    if (prevQty < numQty - 0.0001) {
      return res.status(400).json({
        success: false,
        message: `Lượng tồn trong chai ${currentBottle.bottle_code} (${prevQty} ${currentBottle.unit}) không đủ để sử dụng ${numQty} ${currentBottle.unit}!`,
      });
    }

    const newQty = Math.max(0, Math.round((prevQty - numQty) * 10000) / 10000);
    const newStatus = newQty <= 0.0001 ? 'EMPTY' : 'IN_USE';
    const todayStr = new Date().toISOString().split('T')[0];

    // 2. Update bottle record atomically
    const { data: updatedBottle, error: updateErr } = await supabase
      .from('bottles')
      .update({
        current_quantity: newQty,
        status: newStatus,
        opened_date: currentBottle.opened_date || todayStr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentBottle.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Supabase update bottle error:', updateErr);
      return res.status(500).json({ success: false, message: `Lỗi cập nhật chai: ${updateErr.message}` });
    }

    // 3. Log usage transaction
    const resolvedUserId = isUuid(userId) ? userId : null;
    const resolvedChemId = isUuid(chemicalId) ? chemicalId : currentBottle.chemical_id;

    const { data: usageTx, error: usageTxErr } = await supabase
      .from('usage_transactions')
      .insert({
        user_id: resolvedUserId,
        user_name: userName || 'Người dùng',
        chemical_id: resolvedChemId,
        chemical_name: chemicalName || 'Hóa chất',
        bottle_id: currentBottle.id,
        bottle_code: currentBottle.bottle_code,
        quantity_used: numQty,
        unit: currentBottle.unit || unit || 'mL',
        quantity_before: prevQty,
        quantity_after: newQty,
        usage_purpose: purpose || 'Nghiên cứu / Thí nghiệm',
        project_name: project || 'IRP-2026',
        notes: notes || `Sử dụng từ chai ${currentBottle.bottle_code}`,
      })
      .select()
      .maybeSingle();

    if (usageTxErr) {
      console.warn('Could not insert usage_transactions row:', usageTxErr.message);
    }

    // 4. Log stock transaction
    await supabase.from('stock_transactions').insert({
      chemical_id: resolvedChemId,
      chemical_name: chemicalName || 'Hóa chất',
      bottle_id: currentBottle.id,
      bottle_code: currentBottle.bottle_code,
      user_id: resolvedUserId,
      user_name: userName || 'Người dùng',
      transaction_type: 'EXPORT',
      quantity: numQty,
      unit: currentBottle.unit || unit || 'mL',
      quantity_before: prevQty,
      quantity_after: newQty,
      reference_id: usageTx?.id || currentBottle.id,
      notes: notes || `Sử dụng hóa chất: ${numQty} ${currentBottle.unit}`,
    }).then(() => {});

    return res.status(200).json({
      success: true,
      message: `Đã ghi nhận sử dụng -${numQty} ${currentBottle.unit} từ chai ${currentBottle.bottle_code} thành công. Lượng tồn mới: ${newQty} ${currentBottle.unit}.`,
      bottle: {
        id: updatedBottle.id,
        currentVolume: newQty,
        status: newStatus,
        openedDate: updatedBottle.opened_date,
      },
      usageTransactionId: usageTx?.id,
    });
  } catch (err: any) {
    console.error('api/record-usage error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Lỗi máy chủ khi ghi nhận sử dụng.' });
  }
}
