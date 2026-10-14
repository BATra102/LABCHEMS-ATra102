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
      name,
      englishName,
      code,
      casNumber,
      category = 'Solvents',
      grade = 'AR',
      physicalForm = 'liquid',
      primaryUnit = 'mL',
      manufacturer = 'Standard Lab Supply',
      catalogNumber,
      storageLocation,
      initialBottle,
    } = req.body || {};

    const cleanName = (name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Tên hóa chất không được để trống.' });
    }

    const locObj = typeof storageLocation === 'object' && storageLocation !== null
      ? storageLocation
      : { building: 'Building A', room: 'Room 302', cabinet: 'Cabinet C1', shelf: 'Shelf 1' };

    const chemPayload = {
      name: cleanName,
      cas_number: (casNumber || 'N/A').trim(),
      category: category,
      purity: grade,
      manufacturer: manufacturer,
      catalog_number: catalogNumber || code || null,
      unit: primaryUnit,
      minimum_stock: 500,
      warning_stock: 1000,
      storage_location: JSON.stringify(locObj),
      storage_requirements: 'Nhiệt độ phòng 20-25°C',
      description: englishName || cleanName,
      status: 'ACTIVE',
    };

    const { data: insertedChem, error: chemErr } = await supabase
      .from('chemicals')
      .insert(chemPayload)
      .select()
      .single();

    if (chemErr) {
      console.error('Supabase chemical insert error:', chemErr);
      return res.status(500).json({ success: false, message: `Lỗi khi lưu hóa chất: ${chemErr.message}` });
    }

    let insertedBottleRecord = null;

    // Insert initial bottle if requested
    if (initialBottle) {
      const bQty = parseFloat(initialBottle.quantity) || 500;
      const bExpiry = initialBottle.expiryDate || new Date(Date.now() + 730 * 86400000).toISOString().split('T')[0];
      let bCode = (initialBottle.bottleCode || '').trim();
      if (!bCode) {
        bCode = `${(code || cleanName).slice(0, 3).toUpperCase()}-001`;
      }
      const bQr = (initialBottle.qrCode || bCode).trim();

      const bottlePayload = {
        chemical_id: insertedChem.id,
        bottle_code: bCode,
        qr_code: bQr,
        barcode: bCode,
        lot_number: initialBottle.lotNumber || `LOT-${new Date().getFullYear()}-001`,
        original_quantity: bQty,
        current_quantity: bQty,
        unit: primaryUnit,
        expiry_date: bExpiry,
        storage_location: JSON.stringify(locObj),
        cabinet_id: locObj.cabinet || 'Cabinet C1',
        cabinet_shelf: locObj.shelf || 'Shelf 1',
        status: 'SEALED',
      };

      const { data: bData, error: bErr } = await supabase
        .from('bottles')
        .insert(bottlePayload)
        .select()
        .single();

      if (!bErr && bData) {
        insertedBottleRecord = {
          id: bData.id,
          chemicalId: bData.chemical_id,
          bottleCode: bData.bottle_code,
          qrId: bData.qr_code,
          lotNumber: bData.lot_number || '',
          initialVolume: Number(bData.original_quantity) || 0,
          currentVolume: Number(bData.current_quantity) || 0,
          unit: bData.unit || 'mL',
          expiryDate: bData.expiry_date,
          receivedDate: new Date().toISOString().split('T')[0],
          location: locObj,
          status: 'FULL',
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: `Đã khai báo hóa chất "${cleanName}" thành công!`,
      chemical: {
        id: insertedChem.id,
        code: insertedChem.catalog_number || code || cleanName.slice(0, 4).toUpperCase(),
        name: insertedChem.name,
        englishName: insertedChem.description || cleanName,
        casNumber: insertedChem.cas_number,
        grade: insertedChem.purity || grade,
        category: insertedChem.category || category,
        physicalForm: physicalForm,
        primaryUnit: insertedChem.unit || primaryUnit,
        manufacturer: insertedChem.manufacturer || manufacturer,
        minimumStock: Number(insertedChem.minimum_stock) || 500,
        warningStock: Number(insertedChem.warning_stock) || 1000,
        targetStock: 2500,
        unitPrice: 100000,
        storageLocation: locObj,
        storageConditions: insertedChem.storage_requirements || 'Nhiệt độ phòng',
        safetyInfo: {
          ghsPictograms: ['irritant'],
          hazardClass: 'H315, H319',
          ppe: ['Găng tay', 'Kính'],
          incompatibilities: '',
        },
        responsiblePerson: 'Lab Manager',
        status: 'ACTIVE',
      },
      bottle: insertedBottleRecord,
    });
  } catch (err: any) {
    console.error('api/add-chemical exception:', err);
    return res.status(500).json({ success: false, message: err.message || 'Lỗi xử lý máy chủ khi thêm hóa chất.' });
  }
}
