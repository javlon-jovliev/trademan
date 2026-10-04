import { en, uz, type Key } from "../i18n/dictionaries";
const definitions: Partial<Record<Key, [string, string]>> = {
  allocation: [
    "Asset-class exposure as a percentage of account equity. Position exposure uses absolute values; cash uses the broker cash balance.",
    "Aktiv turi bo‘yicha kapitalga nisbatan ulush. Pozitsiyalar uchun mutlaq qiymat, pul uchun broker pul qoldig‘i ishlatiladi.",
  ],
  netLiquidation: [
    "Broker net liquidation: cash and marked-to-market positions after liabilities. In {currency}; broker-booked fees are already reflected.",
    "Broker kapitali: pul va bozor narxidagi pozitsiyalar, majburiyatlar hisobga olingan. {currency} valyutasida; broker ushlab qolgan komissiya allaqachon aks etgan.",
  ],
  equity: [
    "Account net liquidation snapshots over the selected period, in {currency}.",
    "Tanlangan davrdagi akkaunt kapitali tarixi, {currency} valyutasida.",
  ],
  daily: [
    "Change in account equity since the start of the broker calendar day, adjusted for recorded deposits and withdrawals. In {currency}.",
    "Broker kuni boshidan akkaunt kapitalining o‘zgarishi. Qayd etilgan pul kiritish/chiqarishlar chiqarib tashlanadi. {currency} valyutasida.",
  ],
  unrealized: [
    "Profit/loss on open positions using current price, broker average cost, signed quantity, multiplier and FX. Broker average cost may include fees.",
    "Ochiq pozitsiyalardagi foyda/zarar: joriy narx, broker o‘rtacha tannarxi, miqdor, multiplier va FX asosida. Broker tannarxida komissiya bo‘lishi mumkin.",
  ],
  heat: [
    "Loss to the risk stops across all positions, as a percentage of account equity. Unknown if any required stop, price or FX is missing.",
    "Barcha pozitsiyalar risk stopgacha yursa yuzaga keladigan zarar, kapitalga nisbatan foizda. Stop, narx yoki FX yetishmasa hisoblab bo‘lmaydi.",
  ],
  riskTab: [
    "Loss from current price to this position's risk stop, divided by account equity. The second line shows the scenario limit.",
    "Shu pozitsiyaning joriy narxidan risk stopgacha zarari, akkaunt kapitaliga nisbatan. Ikkinchi qatorda senariy limiti ko‘rsatiladi.",
  ],
  position: [
    "Signed position size. Positive = long; negative = short. The multiplier converts each unit into its contract value.",
    "Pozitsiya miqdori: musbat — long, manfiy — short. Multiplier har bir birlikning kontrakt qiymatini hisoblash uchun ishlatiladi.",
  ],
  price: [
    "Current market price on the first line; broker average entry cost on the second. In the instrument currency, which may differ from account currency.",
    "Birinchi qatorda joriy bozor narxi, ikkinchisida brokerning o‘rtacha kirish tannarxi. Aktiv valyutasida; akkaunt valyutasidan farq qilishi mumkin.",
  ],
  value: [
    "Signed market value = price × quantity × multiplier × FX, in {currency}. Weight uses absolute market value / equity.",
    "Bozor qiymati = narx × miqdor × multiplier × FX, {currency} valyutasida. Ulush = mutlaq bozor qiymati / kapital.",
  ],
  pnl: [
    "Open-position P&L on the first line; position change since previous close on the second. Includes quantity, multiplier and FX. Missing prior close stays unknown.",
    "Birinchi qatorda ochiq pozitsiya P&L’i, ikkinchisida avvalgi yopilish narxidan o‘zgarish. Miqdor, multiplier va FX hisobga olingan. Avvalgi narx bo‘lmasa ikkinchi qiymat noma’lum.",
  ],
  margin: [
    "Maintenance margin required by the broker / account equity × 100. Higher usage leaves less margin buffer.",
    "Broker talab qilgan maintenance margin / kapital × 100. Yuqori foiz margin zaxirasi kamroq ekanini bildiradi.",
  ],
  liquidity: [
    "Net liquidation minus maintenance margin, reported by the broker in {currency}. This is a margin buffer, not withdrawable cash.",
    "Broker ma’lumotidagi kapitaldan maintenance margin chiqarilgan zaxira, {currency} valyutasida. Bu margin zaxirasi; yechib olinadigan pul emas.",
  ],
  buyingPower: [
    "Broker-estimated purchasing capacity in {currency}. It is not cash and can vary by instrument and margin rules.",
    "Broker hisoblagan xarid quvvati, {currency} valyutasida. Bu naqd pul emas; aktiv va margin qoidalariga bog‘liq.",
  ],
  cash: [
    "Cash balance reported by the broker, in {currency}. Cash as a percentage uses current net liquidation.",
    "Broker qayd etgan pul qoldig‘i, {currency} valyutasida. Pul ulushi joriy kapitalga nisbatan hisoblanadi.",
  ],
  drawdown: [
    "Decline from the highest flow-adjusted equity snapshot in the recorded history, as a percentage of that peak.",
    "Qayd etilgan tarixdagi eng yuqori, pul oqimlariga tuzatilgan kapitaldan pasayish. O‘sha cho‘qqiga nisbatan foizda.",
  ],
  maxHeat: [
    "Maximum total loss to all risk stops, as a percentage of equity.",
    "Barcha risk stoplargacha jami zarar uchun limit, kapitalga nisbatan foizda.",
  ],
  warningHeat: [
    "Portfolio heat level that triggers a warning before the maximum heat limit.",
    "Maksimal heat limitiga yetmasdan ogohlantirish beriladigan daraja, foizda.",
  ],
  maxTradeRisk: [
    "Maximum current-price-to-stop risk for one position, as a percentage of equity.",
    "Bitta pozitsiyaning joriy narxidan stopgacha zarar limiti, kapitalga nisbatan foizda.",
  ],
  maxPosition: [
    "Maximum absolute market value of one position / equity × 100.",
    "Bitta pozitsiyaning mutlaq bozor qiymati / kapital × 100 uchun limit.",
  ],
  maxGross: [
    "Maximum sum of absolute position values / equity × 100. Both longs and shorts add exposure.",
    "Barcha pozitsiyalarning mutlaq qiymatlari yig‘indisi / kapital × 100 limiti. Long va short ikkalasi ham qo‘shiladi.",
  ],
  maxNet: [
    "Maximum absolute signed net exposure / equity × 100. Long and short exposures offset each other.",
    "Long va shortlar o‘zaro ayirilgandan keyingi mutlaq sof qiymat / kapital × 100 limiti.",
  ],
  maxMargin: [
    "Maximum maintenance margin / equity × 100.",
    "Maintenance margin / kapital × 100 uchun maksimal limit.",
  ],
  minLiquidity: [
    "Minimum excess liquidity / equity × 100. Falling below this level breaches the scenario.",
    "Excess liquidity / kapital × 100 uchun minimal talab. Bundan pastlash limit buzilishi hisoblanadi.",
  ],
  dailyLoss: [
    "Maximum decline from the last equity snapshot before the broker calendar day, adjusted for recorded external flows.",
    "Broker kuni oldidan olingan oxirgi kapital qiymatidan joriy qiymatgacha pasayish limiti. Qayd etilgan pul oqimlariga tuzatiladi.",
  ],
  weeklyLoss: [
    "Maximum decline from the last equity snapshot before Monday in the broker timezone, adjusted for recorded flows.",
    "Broker vaqt zonasida dushanbadan oldingi oxirgi kapitaldan pasayish limiti. Qayd etilgan pul oqimlariga tuzatiladi.",
  ],
  monthlyLoss: [
    "Maximum decline from the last equity snapshot before the broker calendar month, adjusted for recorded flows.",
    "Broker oyi boshidan oldingi oxirgi kapitaldan pasayish limiti. Qayd etilgan pul oqimlariga tuzatiladi.",
  ],
  totalDrawdown: [
    "Maximum drawdown from the highest flow-adjusted equity in the available recorded history.",
    "Mavjud tarixdagi eng yuqori, pul oqimlariga tuzatilgan kapitaldan maksimal pasayish limiti.",
  ],
  sector: [
    "Combined absolute position value in this sector / equity × 100. Shorts also count toward concentration.",
    "Shu sektordagi pozitsiyalarning mutlaq qiymati / kapital × 100. Shortlar ham konsentratsiyaga qo‘shiladi.",
  ],
  sectorLimit: [
    "Default maximum sector concentration, as a percentage of account equity.",
    "Sektor konsentratsiyasi uchun standart maksimal limit, kapitalga nisbatan foizda.",
  ],
  sectorLimits: [
    "Overrides the default sector limit for named sectors. Values are percentages of account equity.",
    "Alohida sektorlar uchun standart limitni almashtiradi. Qiymatlar kapitalga nisbatan foizda.",
  ],
  assetLimits: [
    "Maximum absolute exposure for each asset class, as a percentage of equity.",
    "Har bir aktiv turi bo‘yicha maksimal mutlaq ulush, kapitalga nisbatan foizda.",
  ],
  warningPercent: [
    "Warning starts at this percentage of a rule's limit. 80% of a 20% position limit means a warning at 16% exposure.",
    "Qoida limitining shu foiziga yetganda ogohlantiriladi. Masalan, 20% limitning 80%i — 16% ulushda ogohlantirish.",
  ],
  riskStop: [
    "Planning price used to estimate risk, in instrument currency. This setting does not place a stop order at the broker.",
    "Riskni hisoblash uchun reja narxi, aktiv valyutasida. Bu sozlama brokerda stop order ochmaydi.",
  ],
  entry: [
    "Actual execution entry price in instrument currency. History execution P&L converts to account currency using recorded FX.",
    "Bajarilgan kirish narxi, aktiv valyutasida. Tarixdagi P&L qayd etilgan FX bilan akkaunt valyutasiga aylantiriladi.",
  ],
  exit: [
    "Actual execution exit price in instrument currency. Slippage is already reflected in this price.",
    "Bajarilgan chiqish narxi, aktiv valyutasida. Slippage bu narxda allaqachon aks etgan.",
  ],
  closedAt: [
    "Execution closing date/time in {timezone}. The full timestamp is available on hover.",
    "Execution yopilgan sana-vaqt, {timezone} bo‘yicha. To‘liq vaqtni ustiga kursor olib borib ko‘rish mumkin.",
  ],
  reason: [
    "Recorded closure reason. ERTA does not guess stop-loss or take-profit from execution prices; absent evidence stays unclassified.",
    "Qayd etilgan yopilish sababi. ERTA narxdan stop-loss yoki take-profit deb taxmin qilmaydi; dalil bo‘lmasa aniqlanmagan deb ko‘rsatadi.",
  ],
  realized: [
    "(Exit − entry) × signed quantity × multiplier × recorded FX, minus allocated opening and closing commissions. In {currency}; slippage is not deducted twice.",
    "(Chiqish − kirish) × miqdor × multiplier × qayd etilgan FX, so‘ng ochilish/yopilish komissiyasi ayiriladi. {currency} valyutasida; slippage qayta ayirilmaydi.",
  ],
  hypothetical: [
    "P&L if the closed quantity were still held at the latest available candle close, using recorded FX and original fees. Not a live quote or a forecast.",
    "Yopilgan miqdor oxirgi mavjud sham narxigacha ushlab turilgandagi P&L. Qayd etilgan FX va asl komissiya ishlatiladi. Bu jonli narx yoki prognoz emas.",
  ],
  missed: [
    "Hypothetical held P&L minus realized P&L. Positive means holding would have improved the result; negative means closing helped.",
    "Ushlab turilgandagi P&L − yopilgandagi P&L. Musbat bo‘lsa ushlab turish foydaliroq, manfiy bo‘lsa yopish foydaliroq bo‘lgan.",
  ],
  mae: [
    "Worst adverse price excursion after exit relative to the exit price, applied to the closed quantity. In {currency}.",
    "Yopilgandan keyingi narxning chiqish narxiga nisbatan eng yomon yurishi, yopilgan miqdor uchun. {currency} valyutasida.",
  ],
  mfe: [
    "Best favorable price excursion after exit relative to the exit price, applied to the closed quantity. In {currency}.",
    "Yopilgandan keyingi narxning chiqish narxiga nisbatan eng foydali yurishi, yopilgan miqdor uchun. {currency} valyutasida.",
  ],
  maxDrawdown: [
    "Largest post-exit peak-to-trough decline estimated from daily high/low candles. Intraday ordering is unknown, so this is an estimate.",
    "Yopilgandan keyingi kunlik high/low shamlar asosida hisoblangan eng katta cho‘qqidan pasayish. Kun ichidagi tartib noma’lum, shu sabab bu taxminiy qiymat.",
  ],
  commissionCost: [
    "Broker commission converted to account currency using the commission currency's applicable rate. Negative values are rebates; missing conversion is unknown.",
    "Broker komissiyasi o‘z valyuta kursi orqali akkaunt valyutasiga aylantirilgan. Manfiy qiymat — rebate; kurs yetishmasa noma’lum.",
  ],
  entryCommission: [
    "Opening execution commission allocated proportionally to this closed FIFO lot.",
    "Ochilish execution komissiyasining shu yopilgan FIFO lotga mutanosib ajratilgan qismi.",
  ],
  exitCommission: [
    "Closing execution commission allocated proportionally to this closed FIFO lot.",
    "Yopilish execution komissiyasining shu yopilgan FIFO lotga mutanosib ajratilgan qismi.",
  ],
  slippageCost: [
    "Execution price versus a sampled pre-fill bid/ask midpoint, multiplied by signed size, multiplier and FX. Positive = cost; negative = improvement. Partial coverage gives a subtotal.",
    "Bajarilgan narx va undan oldin qayd etilgan bid/ask o‘rtacha narxi farqi × miqdor × multiplier × FX. Musbat — xarajat, manfiy — yaxshiroq narx. Qamrov qisman bo‘lsa, bu faqat o‘lchangan qism.",
  ],
  totalExecutionCost: [
    "Commission plus measured slippage. Only shown when both are fully covered. This diagnostic is not deducted again from broker equity or P&L.",
    "Komissiya + o‘lchangan slippage. Ikkalasi to‘liq bo‘lgandagina ko‘rsatiladi. Bu tahliliy qiymat; broker kapitali yoki P&L’dan qayta ayirilmaydi.",
  ],
  netExecutionPnl: [
    "Current-price P&L from matched open execution lots, less their remaining opening commission once. Not calculated by deducting fees from broker average cost.",
    "Mos kelgan ochiq execution lotlarining joriy narxdagi P&L’i; qolgan ochilish komissiyasi bir marta ayiriladi. Broker o‘rtacha tannarxidan qayta komissiya ayirish emas.",
  ],
  executionCosts: [
    "First line: allocated commission. Second line: measured slippage. A dash means missing data, not zero; * indicates partial benchmark coverage.",
    "Birinchi qator — ajratilgan komissiya. Ikkinchi qator — o‘lchangan slippage. Chiziqcha nol emas, ma’lumot yo‘qligini bildiradi; * — narx qamrovi qisman.",
  ],
  count: [
    "Number of currently open position rows.",
    "Hozir ochiq pozitsiya qatorlari soni.",
  ],
  timezone: [
    "User display timezone. Broker-day risk calculations and trade-history filters use the account's broker timezone.",
    "Foydalanuvchining ko‘rsatish vaqt zonasi. Broker kuni riski va savdo tarixi filtrlari akkauntning broker vaqt zonasidan foydalanadi.",
  ],
  baseCurrency: [
    "Preferred display setting. Risk and execution costs currently use the broker account's base currency; changing this does not convert broker balances.",
    "Afzal ko‘rish sozlamasi. Risk va savdo xarajatlari broker akkaunti valyutasida hisoblanadi; bu sozlamani o‘zgartirish broker balansini aylantirmaydi.",
  ],
};
export function valueExplanation(
  label: string,
  language: "uz" | "en",
  currency = "USD",
  timezone = "America/New_York",
) {
  const dict = language === "en" ? en : uz;
  const key = (Object.keys(definitions) as Key[]).find(
    (k) => dict[k] === label,
  );
  const text = key ? definitions[key]?.[language === "en" ? 0 : 1] : undefined;
  return text
    ?.replaceAll("{currency}", currency)
    .replaceAll("{timezone}", timezone);
}
