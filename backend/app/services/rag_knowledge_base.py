"""
Static Indian personal finance knowledge base + TF-IDF retrieval.

Deliberately avoids sentence-transformers/torch/chromadb (Railway can't run
them) — retrieval uses scikit-learn's TfidfVectorizer + cosine similarity,
fit once and cached in module-level globals.
"""
from typing import List, Optional

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

MIN_SIMILARITY = 0.05

KNOWLEDGE_CHUNKS: List[str] = [
    # --- Tax saving ---
    "Section 80C of the Income Tax Act lets an individual deduct up to ₹1.5 lakh per financial year from taxable income. "
    "Eligible instruments include PPF, ELSS mutual funds, NSC, life insurance premiums, EPF contributions, SCSS, 5-year "
    "tax-saving fixed deposits, and home loan principal repayment. The ₹1.5 lakh limit is combined across all these "
    "instruments, not per instrument, so it pays to plan which ones to use together.",
    "PPF (Public Provident Fund) contributions qualify for Section 80C deduction up to ₹1.5 lakh a year. It has a 15-year "
    "lock-in and the interest earned, along with the maturity amount, is completely tax-free (EEE status). It's one of the "
    "safest 80C options since it's backed by the government, but the long lock-in makes it less liquid than other choices.",
    "ELSS (Equity Linked Savings Scheme) mutual funds qualify for Section 80C deduction and have the shortest lock-in "
    "among 80C options at just 3 years, versus 15 years for PPF or 5 years for tax-saving FDs. Because ELSS invests in "
    "equities, it offers better long-term growth potential than fixed-income 80C options, making it a popular pick for "
    "younger investors who can tolerate market volatility.",
    "NSC (National Savings Certificate) is a fixed-income 80C instrument with a 5-year tenure, issued by the post office. "
    "Interest is compounded annually but paid out only at maturity, and it is taxable (though the interest reinvested "
    "each year, except the final year, can itself be claimed under 80C). It suits conservative savers who want a "
    "government-backed, fixed-return alternative to bank FDs.",
    "Life insurance premiums paid for yourself, your spouse, or your children qualify for Section 80C deduction, subject "
    "to conditions on premium-to-sum-assured ratio. Many people mistakenly treat insurance premium as their main 80C "
    "instrument, but pure term insurance premiums are usually small, so it's rarely enough on its own to use up the full "
    "₹1.5 lakh limit.",
    "Your own EPF (Employee Provident Fund) contribution — the portion deducted from your salary, not the employer's "
    "matching share — counts toward the Section 80C limit. Since EPF is often deducted automatically every month, it's "
    "worth checking how much of the ₹1.5 lakh limit is already used up by EPF before making other 80C investments.",
    "SCSS (Senior Citizens' Savings Scheme) is an 80C-eligible, government-backed fixed-income scheme meant for people "
    "aged 60 and above (or 55+ for those who've opted for retirement). It typically offers a higher interest rate than "
    "regular bank FDs and pays interest quarterly, making it a popular retirement-income option for senior citizens.",
    "5-year tax-saving fixed deposits with banks or post offices qualify for Section 80C deduction, but unlike regular "
    "FDs they cannot be withdrawn before the 5-year lock-in ends. Interest earned is fully taxable at your slab rate, "
    "which makes ELSS or PPF more tax-efficient over the same or shorter horizon for many investors.",
    "The principal portion of your home loan EMI qualifies for Section 80C deduction (up to the overall ₹1.5 lakh cap), "
    "separate from the interest portion which is deducted under Section 24(b). For many homeowners, home loan principal "
    "alone can use up a large chunk of the 80C limit, leaving less room for other tax-saving investments.",
    "Section 80D allows a deduction for health insurance premiums: up to ₹25,000 for premiums paid for yourself, spouse, "
    "and dependent children, and an additional ₹25,000 (₹50,000 if they are senior citizens) for premiums paid for "
    "parents. This is separate from and in addition to the Section 80C limit, so it's a distinct way to reduce taxable "
    "income while also protecting against medical expenses.",
    "Section 80CCD(1B) offers an extra deduction of up to ₹50,000 for contributions to the National Pension System "
    "(NPS), over and above the ₹1.5 lakh Section 80C limit. This makes NPS one of the few ways to claim additional tax "
    "savings once the 80C limit is already exhausted through PPF, ELSS, or other instruments.",
    "HRA (House Rent Allowance) exemption lets salaried employees who pay rent reduce their taxable income by the least "
    "of: actual HRA received, rent paid minus 10% of basic salary, or 50% of basic salary (metro) / 40% (non-metro). "
    "To claim it you generally need rent receipts, and if annual rent exceeds ₹1 lakh, your landlord's PAN as well.",
    "The old tax regime allows deductions like 80C, 80D, HRA, and home loan interest but has higher slab rates, while the "
    "new tax regime offers lower slab rates but removes most deductions and exemptions (though it retains the standard "
    "deduction for salaried individuals). Whether the old or new regime works out cheaper depends heavily on how much "
    "you actually invest in 80C/80D instruments and how much HRA or home loan interest you claim — it's worth comparing "
    "both every year, not assuming one is always better.",
    "Under the new tax regime, salaried taxpayers still get a standard deduction (₹50,000–₹75,000 depending on the year's "
    "budget) without needing any investment proof, unlike most old-regime deductions which require actual "
    "investments or expenses. This makes the new regime simpler for people who don't invest heavily in tax-saving "
    "instruments.",

    # --- Investments ---
    "A SIP (Systematic Investment Plan) lets you invest a fixed amount in a mutual fund at regular intervals — usually "
    "monthly — instead of investing a lump sum. It builds investing discipline, removes the need to time the market, "
    "and works well with regular salary income since the amount is auto-debited each month.",
    "SIPs benefit from rupee-cost averaging: because you invest a fixed amount regularly, you automatically buy more "
    "units when prices are low and fewer when prices are high, smoothing out the average purchase cost over time. "
    "Combined with compounding over many years, even modest monthly SIPs can grow substantially — which is why starting "
    "early matters more than the amount invested per month.",
    "Mutual funds are broadly categorized as equity, debt, or hybrid. Equity funds invest mainly in stocks and suit "
    "long-term goals (5+ years) with higher risk and return potential; debt funds invest in bonds and money-market "
    "instruments for lower risk and steadier (though modest) returns; hybrid funds mix both to balance risk and return "
    "for medium-term goals.",
    "Equity mutual funds invest at least 65% of assets in stocks and are suited to long-term goals like retirement or a "
    "child's education, typically 5-7+ years out, since equities are volatile in the short term but have historically "
    "outperformed other asset classes over long periods in India.",
    "Debt mutual funds invest in government securities, corporate bonds, and money-market instruments, offering more "
    "stability than equity funds but generally lower long-term returns. They suit shorter time horizons (1-3 years) or "
    "conservative investors, though since April 2023 gains from most debt funds are taxed at your income slab rate "
    "regardless of holding period, removing the earlier indexation benefit.",
    "Hybrid mutual funds combine equity and debt in a single scheme, aiming to balance growth potential with reduced "
    "volatility. They suit investors who want equity-like returns without the full risk of a pure equity fund, or who "
    "are moving toward a goal that's still a few years away but not immediate.",
    "PPF currently offers an interest rate in the 7-7.1% range per annum (revised quarterly by the government), has a "
    "15-year lock-in (extendable in 5-year blocks), and both the interest and maturity amount are completely tax-free. "
    "It's best suited for long-term, low-risk goals like retirement, not for money you might need in the next few years.",
    "NPS (National Pension System) is a market-linked retirement scheme where contributions are invested across equity, "
    "corporate bonds, and government securities based on your chosen allocation. Besides building a retirement corpus, "
    "it offers tax benefits under Section 80CCD(1) (within the 80C limit) and an extra ₹50,000 under Section 80CCD(1B), "
    "though a portion of the maturity corpus must be used to buy an annuity.",
    "ELSS funds are often considered the best 80C option for investors comfortable with equity risk: they combine tax "
    "savings with equity market exposure and have the shortest lock-in (3 years) of any 80C instrument, versus PPF's 15 "
    "years or tax-saving FDs' 5 years. Returns aren't guaranteed since they track equity markets, but historically "
    "ELSS has outperformed fixed-income 80C options over long periods.",
    "Bank fixed deposit (FD) rates in India typically range from about 5.5% to 7.5% per annum depending on the bank, "
    "tenure, and whether you're a senior citizen (who usually get an extra 0.25-0.5%). FDs are low-risk and offer "
    "guaranteed returns, but interest is fully taxable at your slab rate, which can erode real returns after tax and "
    "inflation.",
    "Sovereign Gold Bonds (SGBs), physical gold, and Gold ETFs are the three common ways to invest in gold in India. "
    "SGBs are issued by the RBI, pay an additional 2.5% annual interest, and are exempt from capital gains tax if held "
    "to maturity (8 years) — making them the most tax-efficient option, though they're less liquid than ETFs.",
    "Physical gold (jewellery or coins) carries making charges, storage and safety concerns, and purity risk, and "
    "attracts capital gains tax on sale. It remains popular for cultural and wedding-related reasons in India, but as a "
    "pure investment it's generally less efficient than SGBs or Gold ETFs.",
    "Gold ETFs (Exchange Traded Funds) let you invest in gold through your demat account without worrying about "
    "storage or purity, and they're more liquid than SGBs since they trade on the stock exchange daily. Unlike SGBs, "
    "they don't pay any extra interest and gains are taxed like debt fund gains at your slab rate.",
    "Index funds passively track a market index like the Nifty 50 or Sensex rather than trying to beat it, resulting in "
    "much lower expense ratios than actively managed equity funds. Over long periods, many actively managed large-cap "
    "funds struggle to consistently beat their benchmark after fees, which is why index funds have grown popular for "
    "core long-term equity exposure.",

    # --- Banking ---
    "Savings account interest rates in India typically range from about 4% for large banks to 6-7% for some small "
    "finance banks. Since this is well below typical inflation and equity/debt fund returns over the long run, keeping "
    "large amounts idle in a savings account beyond your emergency fund needs isn't an efficient way to grow wealth.",
    "Credit card interest rates in India are steep, typically in the 36-42% APR range (often quoted as 3-3.5% per "
    "month) when you don't pay your full outstanding bill by the due date. This is far higher than almost any loan "
    "product, which is why carrying a credit card balance month to month is one of the costliest forms of debt.",
    "Paying only the 'minimum amount due' on a credit card avoids a late-payment fee but does not stop interest from "
    "accruing on the full outstanding balance, including new purchases, from the transaction date. This 'minimum "
    "payment trap' can keep a cardholder in debt for years while paying mostly interest — always aim to pay the full "
    "statement balance, not just the minimum.",
    "Autopay or NACH (National Automated Clearing House) mandates let you authorize automatic debits from your bank "
    "account for recurring payments like SIPs, EMIs, or insurance premiums. Setting these up reduces the risk of missed "
    "payments and late fees, and is generally safer than manually remembering every due date.",
    "UPI (Unified Payments Interface) transactions in India are generally capped at ₹1 lakh per transaction for most "
    "use cases, though certain categories like capital markets, insurance, and IPO applications have higher limits "
    "(up to ₹2-5 lakh), and total daily limits are also set by individual banks and NPCI guidelines.",
    "Credit cards typically offer an interest-free grace period (usually 20-50 days) between the purchase date and the "
    "payment due date, but only if you pay your previous bill in full. If any part of the previous bill is unpaid, the "
    "grace period disappears and new purchases start accruing interest immediately from the transaction date.",

    # --- Budgeting rules ---
    "The 50/30/20 rule is a simple budgeting guideline: allocate roughly 50% of take-home income to needs (rent, food, "
    "utilities, EMIs), 30% to wants (dining out, entertainment, shopping), and 20% to savings and debt repayment beyond "
    "minimums. It's a starting framework, not a strict rule — the right split depends on your city, income level, and "
    "goals.",
    "An emergency fund should typically cover 3-6 months of essential living expenses, kept in a liquid and safe place "
    "like a savings account or a liquid mutual fund rather than locked in FDs or equities. It exists to cover job loss, "
    "medical emergencies, or other income disruptions without forcing you to break long-term investments or take "
    "high-interest debt.",
    "Zero-based budgeting means every rupee of income is assigned a specific job — expenses, savings, or investments — "
    "so that income minus all allocations equals zero. Unlike simply tracking what's left over at month-end, this "
    "approach forces intentional decisions about where money goes before it's spent.",
    "'Pay yourself first' means setting aside savings and investments (like a SIP) right when income arrives, before "
    "discretionary spending, rather than saving whatever happens to be left at the end of the month. Automating this "
    "through auto-debit SIPs or recurring transfers makes it much more consistent than manual saving.",
    "A sinking fund is money set aside gradually, in advance, for a known future expense — like an annual insurance "
    "premium, festival shopping, or a planned vacation — so it doesn't become an unplanned shock to your monthly "
    "budget. Splitting a large annual expense into small monthly contributions makes it far easier to absorb.",

    # --- Insurance ---
    "Term insurance is pure life insurance with no savings or investment component: you pay a relatively small premium "
    "for a large sum assured (cover), and the payout only goes to your nominee if you pass away during the policy "
    "term. It's generally the most cost-effective way to protect dependents financially, since almost the entire "
    "premium goes toward the cover itself rather than being split with an investment component.",
    "Health insurance can be bought as an individual plan (covering one person) or a family floater (a shared sum "
    "insured across the family, usually cheaper per person than separate individual policies). Family floaters work "
    "well for young families, but if one member has a serious ongoing health condition, individual policies may make "
    "more sense so that a large claim doesn't exhaust the shared cover for everyone else.",
    "Investment-linked insurance products like ULIPs (Unit Linked Insurance Plans) and endowment policies bundle a "
    "small insurance cover with an investment component, but the returns are typically much lower than a pure mutual "
    "fund investment, and the insurance cover is much smaller than what an equivalent premium in term insurance would "
    "buy. The common advice from financial planners is to keep insurance and investment separate: buy term insurance "
    "for protection and mutual funds/PPF/NPS for investment.",
    "Critical illness insurance pays a lump sum on diagnosis of a specified serious illness (like cancer or a heart "
    "attack), regardless of the actual treatment cost, and is usually bought in addition to a regular health insurance "
    "policy. It helps cover income loss during recovery or expenses not covered by a standard health policy.",
    "Naming and regularly updating a nominee on insurance policies, bank accounts, and investment accounts ensures "
    "your family can access the funds smoothly after your death, without lengthy legal disputes. Many people set a "
    "nominee once and forget to update it after major life events like marriage or having children.",
    "A top-up or super top-up health insurance plan increases your coverage beyond your base health policy's sum "
    "insured, but only kicks in after a specified deductible is crossed (often the base policy's cover amount). It's a "
    "cost-effective way to substantially raise your total health cover without paying for a much larger base policy.",

    # --- Credit ---
    "CIBIL score is a 3-digit number (300-900) representing your creditworthiness in India; a score of 750 or above is "
    "generally considered good and improves your chances of loan/credit-card approval at better interest rates. Lenders "
    "use it, alongside income and other factors, to decide whether to lend and on what terms.",
    "Key factors affecting your CIBIL score include payment history (paying EMIs/credit card bills on time), credit "
    "utilization ratio, length of credit history, the mix of credit types (secured vs unsecured), and the number of "
    "recent credit inquiries. Missing even one EMI or credit card payment can meaningfully hurt your score.",
    "To improve a CIBIL score, focus on paying all EMIs and credit card bills on time, keeping credit utilization below "
    "about 30% of your limit, avoiding multiple loan/credit-card applications in a short period, and maintaining older "
    "credit accounts rather than closing them. Improvement is gradual — it typically takes several months of "
    "consistent good behavior to see a meaningful change.",
    "Credit utilization ratio is the percentage of your total credit card limit that you're currently using; keeping it "
    "below roughly 30% is generally recommended for a healthy CIBIL score. Maxing out a card, even if you pay it off "
    "in full every month, can still lower your score if the utilization is high at the time it's reported to the "
    "bureau.",
    "Defaulting on a loan or credit card, or having an account marked as a 'settlement' rather than fully paid off, can "
    "significantly and persistently damage your CIBIL score, sometimes for years. It's usually far better to "
    "renegotiate EMI terms with the lender or use an emergency fund than to default or settle for less than owed.",

    # --- Common mistakes ---
    "Not having an emergency fund is one of the most common financial mistakes: without one, an unexpected expense "
    "(medical emergency, job loss, urgent repair) often forces people to break long-term investments early, sell at a "
    "loss, or take on high-interest debt like credit cards or personal loans. Building even a small emergency fund "
    "first, before aggressive investing, reduces this risk substantially.",
    "Keeping most or all long-term savings only in fixed deposits feels 'safe' but exposes you to inflation risk: FD "
    "returns (roughly 5.5-7.5%) often barely beat or even lag inflation once you account for tax on the interest, "
    "meaning your money's real purchasing power may grow very little or shrink over long periods. Diversifying into "
    "equity mutual funds or PPF for long-term goals typically helps combat this.",
    "Mixing insurance with investment — through ULIPs or endowment policies — is a common mistake because it usually "
    "delivers a smaller insurance cover and lower investment returns than buying term insurance and mutual funds "
    "separately would. Financial planners generally recommend keeping the two goals (protection and wealth growth) "
    "separate.",
    "Ignoring employer EPF matching is a missed opportunity: many employers match a portion of your own EPF "
    "contribution, which is effectively free money added to your retirement corpus with tax benefits. Since it's "
    "automatically deducted, many employees don't realize how much this compounds over a career and under-appreciate "
    "its value compared to other investments.",
    "Lifestyle inflation — increasing spending every time income rises, rather than increasing savings — is a common "
    "reason people with growing salaries still struggle to build wealth. Deliberately maintaining or only partially "
    "raising your spending after a raise, while directing the rest to savings and investments, helps your savings rate "
    "grow along with your income.",
    "Not periodically reviewing or rebalancing your investment portfolio can leave you with a risk level that no "
    "longer matches your goals or age — for example, an equity-heavy portfolio close to a short-term goal, or an "
    "overly conservative portfolio decades from retirement. An annual review to check asset allocation against your "
    "goals and timeline is generally recommended.",
    "Delaying retirement planning in your 20s and 30s is costly because of how much compounding depends on time: "
    "starting a retirement SIP a decade later usually requires a much larger monthly contribution to reach the same "
    "corpus, simply because there are fewer years for returns to compound. Starting early, even with a small amount, "
    "is generally more powerful than starting late with a larger amount.",

    # --- Additional practical topics ---
    "Home loans offer two separate tax benefits: principal repayment qualifies under Section 80C (within the ₹1.5 "
    "lakh overall limit), while interest paid qualifies under Section 24(b) for a self-occupied property, up to "
    "₹2 lakh per year. Together these can meaningfully reduce taxable income for a homeowner, especially in the early "
    "years of the loan when interest forms a larger share of the EMI.",
    "Section 24(b) allows a deduction of up to ₹2 lakh per year on home loan interest for a self-occupied property "
    "(no upper limit for a fully let-out property, subject to overall loss set-off rules). This is separate from and "
    "in addition to the Section 80C deduction available on the principal portion of the same loan.",
    "Long-term capital gains (LTCG) on equity mutual funds and listed stocks (held over 1 year) above ₹1.25 lakh in a "
    "financial year are taxed at 12.5%, without the indexation benefit that debt investments used to enjoy. This "
    "threshold and rate have changed over the years, so it's worth checking current rules before making large equity "
    "redemptions.",
    "Short-term capital gains (STCG) on equity mutual funds and listed stocks (held under 1 year) are taxed at a flat "
    "rate (20% as per recent rules), regardless of your income tax slab. This is one reason financial planners "
    "generally recommend holding equity investments for at least a year unless there's a specific reason to exit "
    "earlier.",
    "Since April 2023, gains from most debt mutual funds (with equity allocation below 35%) are taxed entirely at your "
    "income tax slab rate, regardless of how long you held them — the earlier indexation benefit for long-term debt "
    "fund holdings was removed. This narrowed the tax advantage debt funds used to have over bank FDs for many "
    "investors.",
    "A Recurring Deposit (RD) lets you deposit a fixed amount every month with a bank for a fixed tenure, earning "
    "interest similar to an FD. It suits people who want to save a fixed amount monthly (rather than a lump sum "
    "upfront) but still want a guaranteed, low-risk return, though like FDs the interest is fully taxable.",
    "Post office savings schemes like NSC, KVP (Kisan Vikas Patra), and time deposits offer government-backed, "
    "fixed-income options often used by conservative savers, particularly in smaller towns. They generally offer "
    "returns comparable to or slightly above bank FDs, with sovereign backing as the main appeal.",
    "Sukanya Samriddhi Yojana (SSY) is a government scheme for the financial future of a girl child (opened before "
    "she turns 10), offering one of the highest interest rates among small savings schemes along with full tax "
    "exemption (EEE status) and an 80C deduction on contributions. It has a long lock-in tied to the girl's age, "
    "making it best suited for goals like higher education or marriage well into the future.",
    "NPS and EPF both build a retirement corpus with tax benefits, but EPF is mostly debt-oriented (government-set "
    "interest rate, mandatory for many salaried employees) while NPS lets you choose an equity/debt mix and offers an "
    "extra ₹50,000 deduction under Section 80CCD(1B) beyond the 80C limit. NPS also requires part of the maturity "
    "corpus to be used for an annuity, which EPF does not.",
    "Credit card reward points and cashback offers can encourage overspending if the pursuit of rewards leads to "
    "purchases you wouldn't otherwise make, or to carrying a revolving balance that accrues interest far higher than "
    "the reward's value. Rewards are only genuinely beneficial if you pay your full bill on time every month.",
    "Using a loan or overdraft against a fixed deposit is usually far cheaper than reaching for a credit card cash "
    "advance or personal loan in an emergency, since the interest rate is typically only a couple of percentage points "
    "above the FD's own rate and you don't need to break the FD itself. It's a useful option to know about for "
    "short-term liquidity needs without disturbing long-term savings.",
]


_vectorizer: Optional[TfidfVectorizer] = None
_chunk_vectors = None


def _ensure_fitted() -> None:
    global _vectorizer, _chunk_vectors
    if _vectorizer is not None:
        return
    vectorizer = TfidfVectorizer(stop_words="english")
    vectors = vectorizer.fit_transform(KNOWLEDGE_CHUNKS)
    _vectorizer = vectorizer
    _chunk_vectors = vectors


def retrieve_relevant_knowledge(query: str, top_k: int = 3) -> List[str]:
    q = (query or "").strip()
    if not q:
        return []

    try:
        _ensure_fitted()
        query_vec = _vectorizer.transform([q])
        similarities = cosine_similarity(query_vec, _chunk_vectors)[0]

        ranked_indices = similarities.argsort()[::-1][:top_k]
        if len(ranked_indices) == 0 or similarities[ranked_indices[0]] < MIN_SIMILARITY:
            return []

        return [KNOWLEDGE_CHUNKS[i] for i in ranked_indices if similarities[i] >= MIN_SIMILARITY]
    except Exception:
        return []
