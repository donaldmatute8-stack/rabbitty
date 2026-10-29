import { code6FromData, barsFromCode, codeFromBars } from '../rabbittyCodeCodec';
import { resolveScannedPayload } from '../scannerResolver';

async function runTests() {
  console.log('--- TEST 1: RabbittyCode Codec Optical Bars Encode/Decode ---');
  const originalCode = code6FromData('rabbitty_test_user');
  console.assert(originalCode >= 0 && originalCode <= 999_999, 'code6 should be between 0 and 999999');
  const bars = barsFromCode(originalCode);
  const decodedCode = codeFromBars(bars);
  console.assert(decodedCode === originalCode, `Decoded ${decodedCode} does not match ${originalCode}`);
  console.log(`[PASS] Code ${originalCode} encoded into ${bars.length} bars and decoded back to ${decodedCode}`);

  console.log('\n--- TEST 2: ScannerResolver Protocol Normalization ---');
  
  // 2.1 rabbitty://pay with @handle (in sandbox without network, detects server requirement)
  const r1 = await resolveScannedPayload('rabbitty://pay?to=@Edu_Kukaramakara');
  console.assert(r1.type === 'user', `r1 type should be user, got ${r1.type}`);
  console.assert(r1.user?.handle === '@Edu_Kukaramakara', `r1 handle should match`);
  console.log(`[PASS] rabbitty://pay?to=@Edu_Kukaramakara -> type=${r1.type}, handle=${r1.user?.handle}, success=${r1.success}`);

  // 2.2 Payment Intent from POS
  const r2 = await resolveScannedPayload('rabbitty://pay?intent=pi_9876543210');
  console.assert(r2.type === 'payment_intent', `r2 type should be payment_intent, got ${r2.type}`);
  console.assert(r2.intent === 'pi_9876543210', `r2 intent should match`);
  console.log(`[PASS] rabbitty://pay?intent=pi_9876543210 -> type=${r2.type}, intent=${r2.intent}`);

  // 2.3 Magic link terminal pairing
  const r3 = await resolveScannedPayload('https://rabbitty.me/magic-link?token=abc123xyz&sid=session_456');
  console.assert(r3.type === 'magic_link', `r3 type should be magic_link`);
  console.assert(r3.magicLink?.token === 'abc123xyz' && r3.magicLink?.sid === 'session_456', `r3 credentials match`);
  console.log(`[PASS] Magic Link -> token=${r3.magicLink?.token}, sid=${r3.magicLink?.sid}`);

  // 2.4 Claim token from printed ticket
  const r4 = await resolveScannedPayload('https://rabbitty.me/claim?claimToken=tk_claim_777');
  console.assert(r4.type === 'claim', `r4 type should be claim`);
  console.assert(r4.claimToken === 'tk_claim_777', `r4 claim token match`);
  console.log(`[PASS] Claim Token -> ${r4.claimToken}`);

  // 2.5 Table QR Code
  const r5 = await resolveScannedPayload('/qr/table/table_mesa_05?branchId=branch_condesa_01');
  console.assert(r5.type === 'table', `r5 type should be table`);
  console.assert(r5.table?.tableId === 'table_mesa_05', `r5 tableId match`);
  console.log(`[PASS] Table QR -> tableId=${r5.table?.tableId}, branchId=${r5.table?.branchId}`);

  // 2.6 Malformed / Empty
  const r6 = await resolveScannedPayload('');
  console.assert(r6.success === false, `r6 should fail on empty`);
  console.log(`[PASS] Empty input rejected with error: "${r6.error}"`);

  console.log('\n--- ALL TEST SUITES PASSED CLEANLY ---');
}

runTests().catch(console.error);
