-- ====================================================================
-- LABCHEM INVENTORY - SUPABASE SEED DATA
-- Pharmaceutical & Chemistry Laboratory Standard Seed
-- ====================================================================

-- 1. Insert Departments
INSERT INTO public.departments (id, name, description) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'Bộ môn Dược liệu & Chiết xuất', 'Phòng thí nghiệm nghiên cứu hoạt chất tự nhiên, chiết xuất và phân lập hợp chất'),
  ('d2222222-2222-2222-2222-222222222222', 'Bộ môn Hóa Phân tích & Kiểm nghiệm', 'Phòng kiểm nghiệm HPLC, GC-MS và quang phổ UV-Vis'),
  ('d3333333-3333-3333-3333-333333333333', 'Bộ môn Hóa dược', 'Nghiên cứu tổng hợp dẫn xuất và kiểm nghiệm bán thành phẩm dược phẩm'),
  ('d4444444-4444-4444-4444-444444444444', 'Bộ môn Dược lý & Dược lâm sàng', 'Khảo sát hoạt tính sinh học và độc tính trên mô hình thí nghiệm'),
  ('d5555555-5555-5555-5555-555555555555', 'Nghiên cứu sinh Dược học', 'Khu vực làm việc và nghiên cứu độc lập cho học viên cao học & NCS')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Standard Chemicals
INSERT INTO public.chemicals (id, name, cas_number, category, concentration, purity, manufacturer, catalog_number, unit, minimum_stock, warning_stock, hazard_class, ghs_symbols, storage_location, description, status) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'n-Hexane', '110-54-3', 'Solvents', '≥ 99%', 'HPLC Grade', 'Merck KGaA', '1.04374.2500', 'mL', 500, 1000, 'Chất lỏng dễ cháy (Flammable Liquid)', ARRAY['GHS02', 'GHS07', 'GHS08', 'GHS09'], 'Tủ dung môi hữu cơ A1 - Kệ 2', 'Dung môi không phân cực dùng trong sắc ký cột và chiết xuất phytochem.', 'ACTIVE'),
  ('c2222222-2222-2222-2222-222222222222', 'Methanol', '67-56-1', 'Solvents', '≥ 99.8%', 'HPLC Grade', 'Sigma-Aldrich', '34860-2.5L-R', 'mL', 1000, 2000, 'Chất lỏng dễ cháy, Độc tính cấp (Toxic)', ARRAY['GHS02', 'GHS06', 'GHS08'], 'Tủ dung môi hữu cơ A1 - Kệ 1', 'Dung môi phân cực mạnh cho HPLC và chiết phân đoạn cao dược liệu.', 'ACTIVE'),
  ('c3333333-3333-3333-3333-333333333333', 'Ethanol tuyệt đối 99.7%', '64-17-5', 'Solvents', '99.7%', 'AR Grade', 'Xilong Scientific', '10098328', 'mL', 800, 1500, 'Chất lỏng dễ cháy', ARRAY['GHS02', 'GHS07'], 'Tủ dung môi hữu cơ A2 - Kệ 1', 'Dung môi trích ly dược liệu và pha chế thuốc thử định tính.', 'ACTIVE'),
  ('c4444444-4444-4444-4444-444444444444', 'Ethyl Acetate', '141-78-6', 'Solvents', '≥ 99.5%', 'Analytical Grade', 'Fisher Chemical', 'E/0255/17', 'mL', 600, 1200, 'Chất lỏng dễ cháy', ARRAY['GHS02', 'GHS07'], 'Tủ dung môi hữu cơ A2 - Kệ 2', 'Dung môi độ phân cực trung bình cho chiết lỏng-lỏng và chạy TLC.', 'ACTIVE'),
  ('c5555555-5555-5555-5555-555555555555', 'Dichloromethane (DCM)', '75-09-2', 'Solvents', '≥ 99.8%', 'Analytical Grade', 'Merck KGaA', '1.06050.2500', 'mL', 500, 1000, 'Chất nghi ngờ gây ung thư', ARRAY['GHS08'], 'Tủ dung môi halogen A3 - Kệ 1', 'Dung môi trích ly hợp chất alkaloid và flavonoid.', 'ACTIVE'),
  ('c6666666-6666-6666-6666-666666666666', 'Acetonitrile', '75-05-8', 'Solvents', '≥ 99.9%', 'LC-MS Grade', 'Honeywell Burdick & Jackson', 'LC015-2.5', 'mL', 1000, 1500, 'Chất lỏng dễ cháy, Độc tính cấp', ARRAY['GHS02', 'GHS07'], 'Tủ dung môi HPLC B1 - Kệ 1', 'Dung môi pha động cho HPLC gradient phân tích cao định lượng.', 'ACTIVE'),
  ('c7777777-7777-7777-7777-777777777777', 'Axit Clohydric 37% (HCl)', '7647-01-0', 'Acids', '37%', 'Ph. Eur / Reag. USP', 'Merck KGaA', '1.00317.1000', 'mL', 400, 800, 'Ăn mòn kim loại, Ăn mòn da', ARRAY['GHS05', 'GHS07'], 'Tủ Axit chuyên dụng C1 - Kệ đáy', 'Axit vô cơ mạnh dùng thủy phân mẫu và chuẩn độ axit-bazơ.', 'ACTIVE'),
  ('c8888888-8888-8888-8888-888888888888', 'Natri Hydroxit (NaOH hạt)', '1310-73-2', 'Bases', '≥ 98%', 'AR Grade', 'Xilong Scientific', '10019718', 'g', 500, 1000, 'Ăn mòn da nghiêm trọng', ARRAY['GHS05'], 'Tủ Bazo & Muối kiềm D1 - Kệ 2', 'Chất rắn kiềm dùng điều chỉnh pH và pha dung dịch chuẩn.', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Specific Bottles (Quản lý từng chai riêng biệt với mã chai và QR Code)
INSERT INTO public.bottles (id, chemical_id, bottle_code, qr_code, lot_number, original_quantity, current_quantity, unit, opened_date, expiry_date, storage_location, status) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'HEX-001', 'HEX-001', 'LOT-MRK-2024A', 500, 420, 'mL', '2026-08-15', '2028-12-31', 'Tủ dung môi A1 - Kệ 2', 'IN_USE'),
  ('b1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111111', 'HEX-002', 'HEX-002', 'LOT-MRK-2024B', 500, 500, 'mL', NULL, '2029-06-30', 'Tủ dung môi A1 - Kệ 2', 'SEALED'),
  ('b2222222-2222-2222-2222-222222222221', 'c2222222-2222-2222-2222-222222222222', 'MEOH-001', 'MEOH-001', 'LOT-SIG-8812', 1000, 850, 'mL', '2026-09-01', '2028-10-15', 'Tủ dung môi A1 - Kệ 1', 'IN_USE'),
  ('b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'MEOH-002', 'MEOH-002', 'LOT-SIG-8813', 1000, 1000, 'mL', NULL, '2029-01-20', 'Tủ dung môi A1 - Kệ 1', 'SEALED'),
  ('b3333333-3333-3333-3333-333333333331', 'c3333333-3333-3333-3333-333333333333', 'ETOH-001', 'ETOH-001', 'LOT-XIL-9011', 1000, 750, 'mL', '2026-09-10', '2027-05-15', 'Tủ dung môi A2 - Kệ 1', 'IN_USE'),
  ('b4444444-4444-4444-4444-444444444441', 'c4444444-4444-4444-4444-444444444444', 'EA-001', 'EA-001', 'LOT-FSH-4421', 1000, 900, 'mL', '2026-08-20', '2028-08-20', 'Tủ dung môi A2 - Kệ 2', 'IN_USE'),
  ('b6666666-6666-6666-6666-666666666661', 'c6666666-6666-6666-6666-666666666666', 'ACN-001', 'ACN-001', 'LOT-HNW-1102', 1000, 600, 'mL', '2026-09-05', '2027-11-30', 'Tủ dung môi HPLC B1 - Kệ 1', 'IN_USE'),
  ('b7777777-7777-7777-7777-777777777771', 'c7777777-7777-7777-7777-777777777777', 'HCL-001', 'HCL-001', 'LOT-MRK-7711', 500, 350, 'mL', '2026-07-12', '2027-04-10', 'Tủ Axit chuyên dụng C1 - Kệ đáy', 'IN_USE')
ON CONFLICT (bottle_code) DO NOTHING;
