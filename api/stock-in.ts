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
      chemicalId,
      chemicalName,
      bottleCode,
      qrCode,
      lotNumber,
      quantity,
      unit = 'mL',
      expiryDate,
      purchaseDate,
      storageLocation,
      notes,
      existingBottleId,
      userId,
      userName,
    } = req.body || {};

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ success: false, message: 'Số lượng nhập kho phải lớn hơn 0.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const effectiveExpiry = expiryDate || new Date(Date.now() + 730 * 86400000).toISOString().split('T')[0];
    const locObj = typeof storageLocation === 'object' && storageLocation !== null
      ? storageLocation
      : { building: 'Building A', room: 'Room 302', cabinet: 'Cabinet C1', shelf: 'Shelf 1' };

    // =========================================================================
    // CASE 1: CỘNG DUNG TÍCH VÀO CHAI HIỆN TẠI (existingBottleId)
    // =========================================================================
    if (existingBottleId) {
      const { data: currentBottle, error: fetchErr } = await supabase
        .from('bottles')
        .select('*')
        .eq('id', existingBottleId)
        .maybeSingle();

      if (fetchErr || !currentBottle) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy chai cần cộng tồn.' });
      }

      const prevQty = Number(currentBottle.current_quantity) || 0;
      const newQty = Math.round((prevQty + numQty) * 10000) / 10000;
      const newStatus = newQty <= 0 ? 'EMPTY' : 'IN_USE';

      const { data: updatedBottle, error: updateErr } = await supabase
        .from('bottles')
        .update({
          current_quantity: newQty,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBottleId)
        .select()
        .single();

      if (updateErr) {
        return res.status(500).json({ success: false, message: updateErr.message || 'Lỗi khi cập nhật chai.' });
      }

      // Log stock transaction
      await supabase.from('stock_transactions').insert({
        chemical_id: currentBottle.chemical_id,
        chemical_name: chemicalName || 'Hóa chất',
        user_id: isUuid(userId) ? userId : null,
        user_name: userName || 'Quản lý kho',
        transaction_type: 'IMPORT',
        quantity: numQty,
        unit: unit || currentBottle.unit,
        quantity_before: prevQty,
        quantity_after: newQty,
        notes: notes || `Cộng thêm tồn chai ${currentBottle.bottle_code}`,
      }).then(() => {});

      return res.status(200).json({
        success: true,
        message: `Đã cộng thêm +${numQty} ${unit} vào chai ${currentBottle.bottle_code} thành công!`,
        bottle: {
          id: updatedBottle.id,
          chemicalId: updatedBottle.chemical_id,
          bottleCode: updatedBottle.bottle_code,
          qrId: updatedBottle.qr_code || updatedBottle.bottle_code,
          lotNumber: updatedBottle.lot_number || '',
          initialVolume: Number(updatedBottle.original_quantity) || 0,
          currentVolume: Number(updatedBottle.current_quantity) || 0,
          unit: updatedBottle.unit || 'mL',
          expiryDate: updatedBottle.expiry_date,
          status: updatedBottle.status === 'SEALED' ? 'FULL' : updatedBottle.status,
        },
      });
    }

    // =========================================================================
    // CASE 2: TẠO CHAI MỚI VÀO KHO
    // =========================================================================
    let targetChemId = chemicalId;

    // Check if chemicalId is valid UUID; if not, look up in chemicals table
    if (!isUuid(targetChemId)) {
      let query = supabase.from('chemicals').select('id, name, catalog_number');
      if (chemicalName) {
        query = query.ilike('name', `%${chemicalName}%`);
      } else if (chemicalId) {
        query = query.or(`catalog_number.ilike.${chemicalId},cas_number.ilike.${chemicalId},name.ilike.%${chemicalId}%`);
      }
      const { data: foundChem } = await query.limit(1).maybeSingle();
      if (foundChem) {
        targetChemId = foundChem.id;
      } else {
        // Fallback: Pick any first chemical in database
        const { data: fallbackChem } = await supabase.from('chemicals').select('id').limit(1).maybeSingle();
        if (fallbackChem) {
          targetChemId = fallbackChem.id;
        } else {
          return res.status(400).json({ success: false, message: 'Không tìm thấy danh mục hóa chất tương ứng để nhập chai.' });
        }
      }
    }

    // Prepare bottle code & QR code
    let cleanCode = (bottleCode || '').trim();
    if (!cleanCode) {
      cleanCode = `BOT-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    }

    // Check if bottle_code or qr_code already exists to prevent duplicate key constraint
    let finalCode = cleanCode;
    const { data: existingCode } = await supabase
      .from('bottles')
      .select('id, bottle_code')
      .eq('bottle_code', finalCode)
      .maybeSingle();

    if (existingCode) {
      finalCode = `${cleanCode}-${Math.floor(Math.random() * 900 + 100)}`;
    }

    const cleanQr = (qrCode || finalCode).trim();
    let finalQr = cleanQr;
    const { data: existingQr } = await supabase
      .from('bottles')
      .select('id, qr_code')
      .eq('qr_code', finalQr)
      .maybeSingle();

    if (existingQr) {
      finalQr = `${cleanQr}-${Math.floor(Math.random() * 900 + 100)}`;
    }

    const newBottlePayload = {
      chemical_id: targetChemId,
      bottle_code: finalCode,
      qr_code: finalQr,
      barcode: finalCode,
      lot_number: lotNumber || `LOT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      original_quantity: numQty,
      current_quantity: numQty,
      unit: unit,
      opened_date: null,
      expiry_date: effectiveExpiry,
      storage_location: JSON.stringify(locObj),
      cabinet_id: locObj.cabinet || 'Cabinet C1',
      cabinet_shelf: locObj.shelf || 'Shelf 1',
      status: 'SEALED',
      notes: notes || 'Nhập kho qua quét mã QR',
    };

    const { data: insertedBottle, error: insertErr } = await supabase
      .from('bottles')
      .insert(newBottlePayload)
      .select()
      .single();

    if (insertErr) {
      console.error('Supabase bottle insert error:', insertErr);
      return res.status(500).json({
        success: false,
        message: `Lỗi khi lưu chai vào cơ sở dữ liệu: ${insertErr.message}`,
        details: insertErr,
      });
    }

    // Log stock transaction
    await supabase.from('stock_transactions').insert({
      chemical_id: targetChemId,
      chemical_name: chemicalName || 'Hóa chất mới',
      user_id: isUuid(userId) ? userId : null,
      user_name: userName || 'Quản lý kho',
      transaction_type: 'IMPORT',
      quantity: numQty,
      unit: unit,
      quantity_before: 0,
      quantity_after: numQty,
      reference_id: insertedBottle.id,
      notes: notes || `Nhập chai mới [${finalCode}] từ quét mã QR`,
    }).then(() => {});

    return res.status(200).json({
      success: true,
      message: `Đã nhập chai ${finalCode} (${numQty} ${unit}) vào kho thành công!`,
      bottle: {
        id: insertedBottle.id,
        chemicalId: insertedBottle.chemical_id,
        bottleCode: insertedBottle.bottle_code,
        qrId: insertedBottle.qr_code,
        lotNumber: insertedBottle.lot_number || '',
        initialVolume: Number(insertedBottle.original_quantity) || 0,
        currentVolume: Number(insertedBottle.current_quantity) || 0,
        unit: insertedBottle.unit || 'mL',
        expiryDate: insertedBottle.expiry_date,
        receivedDate: todayStr,
        location: locObj,
        status: 'FULL',
        barcode: insertedBottle.barcode || insertedBottle.bottle_code,
      },
    });
  } catch (err: any) {
    console.error('api/stock-in exception:', err);
    return res.status(500).json({ success: false, message: err.message || 'Lỗi xử lý máy chủ khi nhập kho.' });
  }
}
