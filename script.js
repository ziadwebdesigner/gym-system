// ==========================================
// تهيئة البيانات والاتصال بقاعدة بيانات Firebase
// ==========================================
let members = [];
let sessions = [];
let expenses = [];

const app = document.getElementById("app");
const links = document.querySelectorAll(".sidebar a");

// دالة جلب البيانات الحية والتحديث الفوري من Firestore
function initFirebaseListeners() {
    if (!window.db) {
        console.warn("جاري انتظار اتصال Firebase...");
        setTimeout(initFirebaseListeners, 500);
        return;
    }

    const { collection, getDocs } = window;
    const db = window.db;

    // جلب المشتركين
    getDocs(collection(db, "gymMembers")).then((snapshot) => {
        members = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
        showHome(); // تحديث الشاشة الرئيسية أول ما البيانات توصل
    }).catch(err => console.error("خطأ في جلب المشتركين:", err));

    // جلب الحصص
    getDocs(collection(db, "gymTimeSessions")).then((snapshot) => {
        sessions = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
    }).catch(err => console.error("خطأ في جلب الحصص:", err));

    // جلب المصروفات
    getDocs(collection(db, "gymExpenses")).then((snapshot) => {
        expenses = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
    }).catch(err => console.error("خطأ في جلب المصروفات:", err));
}

// دالة حفظ العناصر في Firestore
async function saveToFirestore(collectionName, dataItem) {
    try {
        if (!window.db) return;
        const { collection, addDoc, doc, setDoc } = window;
        const { firestoreId, ...data } = dataItem;

        // نحدّث المستند الحالي عند التعديل بدل إنشاء نسخة جديدة.
        if (firestoreId) {
            await setDoc(doc(window.db, collectionName, firestoreId), data);
        } else {
            const newDoc = await addDoc(collection(window.db, collectionName), data);
            dataItem.firestoreId = newDoc.id;
        }
    } catch (error) {
        console.error("خطأ أثناء الحفظ في السحابة: ", error);
    }
}

async function deleteFromFirestore(collectionName, dataItem) {
    try {
        if (!window.db || !dataItem?.firestoreId) {
            throw new Error("لم يتم العثور على معرف العنصر في قاعدة البيانات");
        }

        await window.deleteDoc(window.doc(window.db, collectionName, dataItem.firestoreId));
        return true;
    } catch (error) {
        console.error("خطأ أثناء الحذف من السحابة: ", error);
        alert("تعذر الحذف من قاعدة البيانات. تأكد من اتصال الإنترنت وصلاحيات Firebase ثم حاول مرة أخرى.");
        return false;
    }
}

// دالة الحفظ العامة المتوافقة مع الكود القديم
function saveData() {
    // تم الاستغناء عن localStorage والاعتماد على Firebase مباشرة عند كل إضافة/تعديل
}

// إدارة التنقل بين الصفحات عبر القائمة الجانبية
links.forEach(link => {
    link.onclick = function(e) {
        e.preventDefault();
        links.forEach(item => item.classList.remove("active"));
        this.classList.add("active");

        const page = this.dataset.page;

        if (page === "home") showHome();
        if (page === "members") showMembers();
        if (page === "sessions") showSessions();
        if (page === "revenues") showRevenues();
        if (page === "expenses") showExpenses();
        if (page === "reports") showReports();
    };
});

// دالة لتنسيق التاريخ بالشكل المعتاد
function formatDate(date) {
    return String(date.getDate()).padStart(2, "0") + " / " +
           String(date.getMonth() + 1).padStart(2, "0") + " / " +
           date.getFullYear();
}

// عرض بانر الجيم العلوي
function bannerHTML() {
    return `<div class="gym-banner"><img src="banner.jpg" alt="Gym Banner"></div>`;
}

// توليد أو استرجاع رقم العضوية للمشترك
function getMemberNumber(member) {
    if (!member.memberNumber) {
        const used = members
            .map(m => Number((m.memberNumber || "").replace("GYM-", "")))
            .filter(Boolean);
        const next = used.length ? Math.max(...used) + 1 : 1;
        member.memberNumber = "GYM-" + String(next).padStart(4, "0");
    }
    return member.memberNumber;
}

function getNextMemberNumber() {
    const numbers = members
        .map(member => Number((member.memberNumber || "").replace("GYM-", "")))
        .filter(number => number > 0);
    return numbers.length ? Math.max(...numbers) + 1 : 1;
}

function getStatusType(member) {
    const today = new Date();
    const end = new Date(member.endDateISO);
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const days = Math.ceil((end - today) / 86400000);

    if (days < 0) return "expired";
    if (days <= 3) return "expiring";
    return "active";
}

function getStatus(member) {
    const type = getStatusType(member);
    if (type === "expired") return `<span class="status expired-status">منتهي</span>`;
    if (type === "expiring") return `<span class="status warning-status">ينتهي قريبًا</span>`;
    return `<span class="status active-status">ساري</span>`;
}

function getCounts() {
    let active = 0, expired = 0, expiring = 0;
    members.forEach(member => {
        const type = getStatusType(member);
        if (type === "active") active++;
        if (type === "expired") expired++;
        if (type === "expiring") expiring++;
    });
    return { active, expired, expiring };
}

function getDurationText(months) {
    months = Number(months);
    if (months === 1) return "شهر واحد";
    if (months === 3) return "3 شهور";
    if (months === 6) return "6 شهور";
    if (months === 12) return "سنة";
    return months + " شهور";
}

function getSubscriptionCount(member) {
    return Number(member.subscriptionCount || 1);
}

function getTotalMonths(member) {
    return Number(member.totalMonths || member.durationMonths || 1);
}

// دالة إرسال رسائل الواتساب
function sendWhatsAppMessage(phone, name, statusType) {
    let message = "";
    if (statusType === 'expiring') {
        message = `أهلاً يا ${name}، نذكرك بأن اشتراكك في الجيم سيقترب من الانتهاء غداً. ننتظر تجديدك لنستمر معاً! 💪`;
    } else if (statusType === 'expired') {
        message = `مرحباً يا ${name}، نأسف لإعلامك أن اشتراكك في الجيم قد انتهى. نرجو التجديد للاستمرار في التمرين. 🏋️‍♂️`;
    } else if (statusType === 'active') {
        message = `مرحباً يا ${name}، تم تجديد اشتراكك بنجاح! شكراً لك وننتظرك في الجيم. 🌟`;
    }

    let cleanPhone = String(phone).replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '2' + cleanPhone;
    }

    let encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
}


// ==========================================
// لوحة التحكم الرئيسية (Dashboard)
// ==========================================
function showHome() {
    clearInterval(sessionRefreshTimer);
    const counts = getCounts();
    const totalMonths = members.reduce((sum, m) => sum + getTotalMonths(m), 0);
    const totalSubscriptions = members.reduce((sum, m) => sum + getSubscriptionCount(m), 0);
    const totalOutstanding = getTotalOutstanding();
    const outstandingMembersCount = getOutstandingMembers().length;

    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>لوحة التحكم الرئيسية (Dashboard)</h1>
                <p>مؤشرات سريعة وملخص عام لأداء الجيم (متصل بـ Firebase)</p>
            </div>
            <div class="admin">المدير</div>
        </header>
        <section class="stats">
            <div class="stat-card">
                <span>إجمالي المشتركين</span>
                <strong>${members.length}</strong>
            </div>
            <div class="stat-card">
                <span>الاشتراكات النشطة</span>
                <strong>${counts.active}</strong>
            </div>
            <div class="stat-card">
                <span>تنتهي قريبًا (غداً)</span>
                <strong>${counts.expiring}</strong>
            </div>
            <div class="stat-card">
                <span>اشتراكات منتهية</span>
                <strong>${counts.expired}</strong>
            </div>
            <div class="stat-card outstanding-home-card" onclick="showOutstandingMembers()" title="عرض المشتركين الذين عليهم مبالغ">
                <span>مبالغ متبقية (${outstandingMembersCount})</span>
                <strong>${totalOutstanding} جنيه</strong>
            </div>
        </section>
        <section class="recent">
            <h2>إحصائيات النظام العامة</h2>
            <div class="subscription-box">
                <div>
                    <span>إجمالي مرات الاشتراك</span>
                    <strong>${totalSubscriptions}</strong>
                </div>
                <div>
                    <span>إجمالي الشهور المسجلة</span>
                    <strong>${totalMonths}</strong>
                </div>
                <div>
                    <span>إجمالي الأعضاء</span>
                    <strong>${members.length}</strong>
                </div>
            </div>
        </section>
    `;
}


// ==========================================
// قسم إدارة المشتركين والواتساب
// ==========================================
function showMembers(search = "") {
    clearInterval(sessionRefreshTimer);
    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>إدارة المشتركين</h1>
                <p>إدارة الأعضاء، متابعة الحالات والتواريخ، التجديد، والتحكم الشامل</p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button id="outstandingMembers" type="button" class="outstanding-members-btn">المبالغ المتبقية</button>
                <button id="addMember" type="button">إضافة مشترك جديد</button>
            </div>
        </header>
        <section class="recent">
            <h2>قائمة الأعضاء المسجلة</h2>
            <input class="search" id="search" placeholder="ابحث بالاسم أو رقم الهاتف أو رقم العضوية" value="${search}">
            <div class="members-grid" id="membersList">
                ${getMembersHTML(search)}
            </div>
        </section>
    `;

    document.getElementById("addMember").onclick = addMember;
    document.getElementById("outstandingMembers").onclick = showOutstandingMembers;
    document.getElementById("search").oninput = function() {
        document.getElementById("membersList").innerHTML = getMembersHTML(this.value);
    };
}

function getMembersHTML(search = "") {
    const text = search.toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list = members.filter(member =>
        (member.name || "").toLowerCase().includes(text) ||
        (member.phone || "").includes(text) ||
        (member.memberNumber || "").toLowerCase().includes(text)
    ).sort((firstMember, secondMember) => {
        const firstEndDate = new Date(firstMember.endDateISO).getTime();
        const secondEndDate = new Date(secondMember.endDateISO).getTime();
        const firstExpired = !Number.isFinite(firstEndDate) || firstEndDate < today.getTime();
        const secondExpired = !Number.isFinite(secondEndDate) || secondEndDate < today.getTime();

        // الاشتراكات السارية الأقرب للانتهاء أولاً، والمنتهية في آخر القائمة.
        if (firstExpired !== secondExpired) return firstExpired ? 1 : -1;
        if (firstExpired) return secondEndDate - firstEndDate;
        return firstEndDate - secondEndDate;
    });

    if (!list.length) return `<div class="empty">لا يوجد مشتركين مسجلين</div>`;
    
    return list.map(member => {
        getMemberNumber(member);
        const statusType = getStatusType(member);
        
        return `
            <div class="member-card member-status-${statusType}">
                <div class="member-id">${member.memberNumber}</div>
                <div class="member-name">${member.name}</div>
                <div class="member-phone">📞 ${member.phone || "لا يوجد رقم هاتف"}</div>
                <span class="membership-type ${member.membershipType === "خاص" ? "private-member" : "regular-member"}">${member.membershipType || "عادي"}</span>
                
                <div class="member-row" style="margin-top: 8px;">
                    <div class="member-box">
                        <span>بداية الاشتراك</span>
                        <p>${member.startDate}</p>
                    </div>
                    <div class="member-box">
                        <span>نهاية الاشتراك</span>
                        <p>${member.endDate}</p>
                    </div>
                </div>

                <div class="member-row">
                    <div class="member-box">
                        <span>مدة الاشتراك</span>
                        <p style="margin-top:3px;">${member.duration} | ${getStatus(member)}</p>
                        <div class="member-payment member-payment-compact ${Number(member.remainingAmount) > 0 ? "has-balance" : ""}">
                            ${Number(member.remainingAmount) > 0
                                ? `متبقي: <strong>${member.remainingAmount} جنيه</strong>
                                   <button class="record-payment-btn" onclick="recordPayment(${member.id})">تسجيل دفعة</button>`
                                : "تم سداد الاشتراك بالكامل ✓"}
                        </div>
                    </div>
                    <div class="member-box">
                        <span>قيمة الاشتراك</span>
                        <p>${member.price} جنيه</p>
                    </div>
                </div>

                ${member.phone ? `
                    <div style="margin-bottom: 8px;">
                        <button onclick="sendWhatsAppMessage('${member.phone}', '${member.name}', '${statusType}')" style="background:#25d366; color:white; border:none; padding:8px; border-radius:6px; font-size:12px; cursor:pointer; width:100%; font-weight:bold;">
                            💬 إرسال رسالة واتساب (${statusType === 'expiring' ? 'تنبيه قرب الانتهاء' : statusType === 'expired' ? 'تنبيه انتهاء الاشتراك' : 'رسالة تفعيل/تجديد'})
                        </button>
                    </div>
                ` : ""}

                <div class="member-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                    <button onclick="renewMember(${member.id})" style="background:#e6f7eb; color:#198754; font-weight:bold; width:100%;">تجديد</button>
                    <button onclick="editMember(${member.id})" style="width:100%;">تعديل</button>
                    <button onclick="showHistory(${member.id})" style="width:100%;">السجل</button>
                    <button onclick="deleteMember(${member.id})" style="color:#dc3545; width:100%;">حذف</button>
                </div>
            </div>
        `;
    }).join("");
}

function addMember() {
    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>إضافة مشترك جديد</h1>
                <p>تسجيل بيانات عضو جديد وبدء اشتراكه الأول</p>
            </div>
        </header>
        <section class="recent member-form">
            <label>اسم المشترك</label>
            <input id="name" type="text">
            <label>رقم الهاتف (اختياري)</label>
            <input id="phone" type="tel" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
            <label>نوع العضوية</label>
            <select id="membershipType">
                <option value="عادي">مشترك عادي</option>
                <option value="خاص">مشترك خاص</option>
            </select>
            <label>تاريخ الاشتراك</label>
            <div class="date-input">
                <input id="day" type="number" placeholder="اليوم" min="1" max="31">
                <input id="month" type="number" placeholder="الشهر" min="1" max="12">
                <input id="year" type="number" placeholder="السنة" min="2020" max="2100">
            </div>
            <label>مدة الاشتراك</label>
            <select id="duration">
                <option value="1">شهر واحد</option>
                <option value="3">3 شهور</option>
                <option value="6">6 شهور</option>
                <option value="12">سنة</option>
            </select>
            <label>سعر الاشتراك (جنيه)</label>
            <input id="price" type="number" min="1">
            <label>المبلغ المتبقي على المشترك (اختياري)</label>
            <input id="remainingAmount" type="number" min="0" placeholder="اتركه فارغًا إذا تم السداد بالكامل">
            <label>تاريخ انتهاء الاشتراك المتوقع</label>
            <input id="endDate" type="text" readonly>
            <button type="button" id="saveMember">حفظ العضو</button>
            <button type="button" id="cancelMember">إلغاء ورجوع</button>
        </section>
    `;

    const day = document.getElementById("day");
    const month = document.getElementById("month");
    const year = document.getElementById("year");
    const duration = document.getElementById("duration");
    const endDate = document.getElementById("endDate");
    const remainingAmountInput = document.getElementById("remainingAmount");

    function calculateEndDate() {
        if (!day.value || !month.value || !year.value) {
            endDate.value = "";
            return;
        }
        const start = new Date(Number(year.value), Number(month.value) - 1, Number(day.value));
        const end = new Date(start);
        end.setMonth(end.getMonth() + Number(duration.value));
        endDate.value = formatDate(end);
    }

    day.oninput = calculateEndDate;
    month.oninput = calculateEndDate;
    year.oninput = calculateEndDate;
    duration.onchange = calculateEndDate;

    document.getElementById("saveMember").onclick = function() {
        const name = document.getElementById("name").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const membershipType = document.getElementById("membershipType").value;
        const price = Number(document.getElementById("price").value);
        const remainingAmount = Number(remainingAmountInput.value || 0);
        const paidAmount = price - remainingAmount;

        if (!name || !price || remainingAmount < 0 || remainingAmount > price || !day.value || !month.value || !year.value) {
            alert("من فضلك أكمل البيانات بشكل صحيح");
            return;
        }

        const start = new Date(Number(year.value), Number(month.value) - 1, Number(day.value));
        const months = Number(duration.value);
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);

        const member = {
            id: Date.now(),
            memberNumber: "GYM-" + String(getNextMemberNumber()).padStart(4, "0"),
            name,
            phone,
            membershipType,
            paidAmount,
            remainingAmount,
            startDate: formatDate(start),
            startDateISO: start.toISOString(),
            duration: duration.options[duration.selectedIndex].text,
            durationMonths: months,
            price,
            endDate: formatDate(end),
            endDateISO: end.toISOString(),
            subscriptionCount: 1,
            totalMonths: months,
            history: [{
                date: formatDate(new Date()),
                startDate: formatDate(start),
                endDate: formatDate(end),
                months,
                price,
                paidAmount,
                remainingAmount,
                type: "اشتراك جديد"
            }]
        };

        members.push(member);
        saveToFirestore("gymMembers", member);
        showMembers();
    };

    document.getElementById("cancelMember").onclick = () => showMembers();
}

function editMember(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;

    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>تعديل بيانات المشترك</h1>
                <p>تحديث الاسم ورقم الهاتف الأساسي للعضو</p>
            </div>
        </header>
        <section class="recent member-form">
            <label>رقم العضوية</label>
            <input type="text" value="${getMemberNumber(member)}" readonly style="background:#f7f8fa;">
            <label>اسم المشترك</label>
            <input id="editName" type="text" value="${member.name || ""}">
            <label>رقم الهاتف (اختياري)</label>
            <input id="editPhone" type="tel" inputmode="numeric" value="${member.phone || ""}" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
            <label>نوع العضوية</label>
            <select id="editMembershipType">
                <option value="عادي" ${member.membershipType !== "خاص" ? "selected" : ""}>مشترك عادي</option>
                <option value="خاص" ${member.membershipType === "خاص" ? "selected" : ""}>مشترك خاص</option>
            </select>
            <label>سعر الاشتراك (جنيه)</label>
            <input id="editPrice" type="number" min="1" value="${member.price || ""}">
            <label>المبلغ المتبقي على المشترك (اختياري)</label>
            <input id="editRemainingAmount" type="number" min="0" value="${member.remainingAmount ?? 0}" placeholder="اتركه فارغًا إذا تم السداد بالكامل">
            <button type="button" id="updateMember">حفظ التعديلات</button>
            <button type="button" id="cancelEdit">رجوع</button>
        </section>
    `;

    const editPriceInput = document.getElementById("editPrice");
    const editRemainingAmountInput = document.getElementById("editRemainingAmount");

    document.getElementById("updateMember").onclick = function() {
        const name = document.getElementById("editName").value.trim();
        const phone = document.getElementById("editPhone").value.trim();
        const membershipType = document.getElementById("editMembershipType").value;
        const price = Number(document.getElementById("editPrice").value);
        const remainingAmount = Number(editRemainingAmountInput.value || 0);
        const paidAmount = price - remainingAmount;

        if (!name || !price || price <= 0 || remainingAmount < 0 || remainingAmount > price) {
            alert("من فضلك أكمل البيانات");
            return;
        }

        member.name = name;
        member.phone = phone;
        member.membershipType = membershipType;
        member.price = price;
        member.paidAmount = paidAmount;
        member.remainingAmount = remainingAmount;

        // ينعكس تعديل السعر على آخر اشتراك مسجل حتى تتطابق التقارير مع البيانات الحالية.
        if (Array.isArray(member.history) && member.history.length) {
            member.history[member.history.length - 1].price = price;
            member.history[member.history.length - 1].paidAmount = paidAmount;
            member.history[member.history.length - 1].remainingAmount = remainingAmount;
        }

        saveToFirestore("gymMembers", member);
        showMembers();
    };

    document.getElementById("cancelEdit").onclick = () => showMembers();
}

function renewMember(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;

    const date = prompt("أدخل تاريخ بداية التجديد بصيغة يوم/شهر/سنة (مثال: 01/09/2026):", formatDate(new Date()).replaceAll(" ", ""));
    if (!date) return;

    const parts = date.split("/");
    if (parts.length !== 3) {
        alert("صيغة التاريخ غير صحيحة");
        return;
    }

    const start = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (isNaN(start.getTime())) {
        alert("التاريخ غير صحيح");
        return;
    }

    const months = Number(prompt("أدخل عدد شهور التجديد:", member.durationMonths || 1));
    if (!Number.isInteger(months) || months < 1) return;

    const price = Number(prompt("أدخل سعر التجديد (بالجنيه):", member.price || 0));
    if (!price || price <= 0) return;

    const paidAmount = Number(prompt("أدخل المبلغ المدفوع (بالجنيه):", price));
    if (isNaN(paidAmount) || paidAmount < 0 || paidAmount > price) return;

    const end = new Date(start);
    end.setMonth(end.getMonth() + months);

    member.startDate = formatDate(start);
    member.startDateISO = start.toISOString();
    member.endDate = formatDate(end);
    member.endDateISO = end.toISOString();
    member.durationMonths = months;
    member.duration = getDurationText(months);
    member.price = price;
    member.paidAmount = paidAmount;
    member.remainingAmount = price - paidAmount;
    member.subscriptionCount = getSubscriptionCount(member) + 1;
    member.totalMonths = getTotalMonths(member) + months;

    if (!Array.isArray(member.history)) member.history = [];
    member.history.push({
        date: formatDate(new Date()),
        startDate: formatDate(start),
        endDate: formatDate(end),
        months,
        price,
        paidAmount,
        remainingAmount: price - paidAmount,
        type: "تجديد اشتراك"
    });

    saveToFirestore("gymMembers", member);
    showMembers();
}

function getOutstandingMembers() {
    return members.filter(member => Number(member.remainingAmount) > 0);
}

function getTotalOutstanding() {
    return getOutstandingMembers().reduce((total, member) => total + Number(member.remainingAmount || 0), 0);
}

function showOutstandingMembers() {
    clearInterval(sessionRefreshTimer);
    const outstandingMembers = getOutstandingMembers();
    const totalOutstanding = getTotalOutstanding();

    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>المبالغ المتبقية على المشتركين</h1>
                <p>قائمة بكل المشتركين الذين لديهم مبالغ غير مسددة</p>
            </div>
            <button type="button" onclick="showMembers()">رجوع للمشتركين</button>
        </header>
        <section class="recent">
            <div class="outstanding-summary">
                <span>إجمالي المبالغ المتبقية</span>
                <strong>${totalOutstanding} جنيه</strong>
                <small>على ${outstandingMembers.length} مشترك</small>
            </div>
            <div class="members-grid">
                ${outstandingMembers.length ? outstandingMembers.map(member => `
                    <div class="member-card outstanding-card">
                        <div class="member-id">${getMemberNumber(member)}</div>
                        <div class="member-name">${member.name}</div>
                        <div class="member-phone">📞 ${member.phone || "لا يوجد رقم هاتف"}</div>
                        <div class="member-payment has-balance">متبقي عليه: <strong>${member.remainingAmount} جنيه</strong></div>
                        <button class="settle-payment-btn" onclick="recordPayment(${member.id})">تسجيل دفعة</button>
                    </div>
                `).join("") : `<div class="empty">لا توجد مبالغ متبقية على أي مشترك 🎉</div>`}
            </div>
        </section>
    `;
}

async function recordPayment(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;

    const remaining = Number(member.remainingAmount) || 0;
    if (remaining <= 0) {
        alert("هذا المشترك سدد الاشتراك بالكامل بالفعل.");
        return;
    }

    const payment = Number(prompt(`المبلغ المتبقي: ${remaining} جنيه\nاكتب قيمة الدفعة الجديدة:`, remaining));
    if (isNaN(payment) || payment <= 0 || payment > remaining) {
        alert("اكتب مبلغًا صحيحًا لا يزيد عن المتبقي.");
        return;
    }

    member.paidAmount = (Number(member.paidAmount) || 0) + payment;
    member.remainingAmount = remaining - payment;

    if (Array.isArray(member.history) && member.history.length) {
        const latestSubscription = member.history[member.history.length - 1];
        latestSubscription.paidAmount = member.paidAmount;
        latestSubscription.remainingAmount = member.remainingAmount;
    }

    await saveToFirestore("gymMembers", member);
    showMembers();
}

async function deleteMember(id) {
    if (!confirm("هل تريد حذف هذا المشترك نهائياً من النظام؟")) return;
    const member = members.find(m => m.id === id);
    if (!await deleteFromFirestore("gymMembers", member)) return;
    members = members.filter(m => m.id !== id);
    showMembers();
}

function showHistory(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;
    if (!Array.isArray(member.history)) member.history = [];

    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>سجل الاشتراكات</h1>
                <p>${member.name} - ${getMemberNumber(member)}</p>
            </div>
        </header>
        <section class="recent">
            <button type="button" onclick="showMembers()">رجوع للمشتركين</button>
            <br><br>
            <div class="subscription-history">
                ${member.history.length ? member.history.map((item, index) => `
                    <div class="history-item" style="background:#f7f8fa; padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid #edf0f3;">
                        <strong>${index + 1}. ${item.type}</strong>
                        <div>تاريخ التسجيل: ${item.date}</div>
                        <div>فترة الاشتراك: من ${item.startDate} إلى ${item.endDate}</div>
                        <div>المدة: ${item.months} شهر</div>
                        <div>سعر الاشتراك: ${item.price} جنيه</div>
                        <div>المبلغ المدفوع: ${item.paidAmount ?? item.price} جنيه</div>
                        <div>المتبقي: ${item.remainingAmount ?? 0} جنيه</div>
                    </div>
                `).join("") : `<div class="empty">لا يوجد سجل اشتراكات سابق</div>`}
            </div>
        </section>
    `;
}


// ==========================================
// قسم إدارة الحصص
// ==========================================
function getSessionStatus(session) {
    const now = new Date();
    const end = new Date(session.endISO);
    return now < end ? "active" : "expired";
}

function getSessionStatusHTML(session) {
    if (getSessionStatus(session) === "active") {
        return `<span class="status active-status">سارية</span>`;
    }
    return `<span class="status expired-status">انتهت</span>`;
}

function formatTime(date) {
    return date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function createSessionDate(date, time) {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    return new Date(year, month - 1, day, hour, minute);
}

function showSessions(search = "") {
    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>الحصص</h1>
                <p>إدارة الحصص الفردية بالوقت والسعر</p>
            </div>
            <button id="addSession" type="button">إضافة حصة</button>
        </header>
        <section class="recent">
            <h2>قائمة الحصص</h2>
            <input class="search" id="sessionSearch" placeholder="ابحث باسم المشترك" value="${search}">
            <div class="sessions-grid" id="sessionsList">
                ${getSessionsHTML(search)}
            </div>
        </section>
    `;

    document.getElementById("addSession").onclick = addSession;
    document.getElementById("sessionSearch").oninput = function() {
        document.getElementById("sessionsList").innerHTML = getSessionsHTML(this.value);
    };
    startSessionAutoRefresh(search);
}

let sessionRefreshTimer;
function startSessionAutoRefresh(search = "") {
    clearInterval(sessionRefreshTimer);
    sessionRefreshTimer = setInterval(() => {
        const list = document.getElementById("sessionsList");
        if (!list) {
            clearInterval(sessionRefreshTimer);
            return;
        }
        list.innerHTML = getSessionsHTML(search);
    }, 1000);
}

function getSessionsHTML(search = "") {
    const text = search.toLowerCase();
    const list = sessions
        .filter(s => (s.name || "").toLowerCase().includes(text))
        .sort((a, b) => new Date(a.startISO) - new Date(b.startISO));

    if (!list.length) {
        return `<div class="empty">لا يوجد حصص</div>`;
    }

    return list.map(session => {
        const status = getSessionStatus(session);
        let remainingText = "";
        if (status === "active") {
            const remaining = new Date(session.endISO).getTime() - Date.now();
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            remainingText = `<div class="session-remaining">متبقي ${minutes} دقيقة و ${seconds} ثانية</div>`;
        } else {
            remainingText = `<div class="session-finished">الحصة انتهت</div>`;
        }

        return `
            <div class="session-card ${status === "expired" ? "session-expired" : ""}">
                <div class="session-top">
                    <div>
                        <div class="session-name">${session.name}</div>
                        <div class="session-date">${session.date}</div>
                    </div>
                    ${getSessionStatusHTML(session)}
                </div>
                ${remainingText}
                <div class="session-info-grid">
                    <div class="session-info">
                        <span>السعر</span>
                        <strong>${session.price} جنيه</strong>
                    </div>
                    <div class="session-info">
                        <span>المدة</span>
                        <strong>${session.duration} دقيقة</strong>
                    </div>
                    <div class="session-info">
                        <span>وقت البداية</span>
                        <strong>${session.startTime}</strong>
                    </div>
                    <div class="session-info">
                        <span>وقت الانتهاء</span>
                        <strong>${session.endTime}</strong>
                    </div>
                </div>
                <div class="session-actions">
                    <button onclick="editSession(${session.id})">تعديل</button>
                    <button onclick="renewSessionItem(${session.id})">تجديد</button>
                    <button class="delete-session" onclick="deleteSession(${session.id})">حذف</button>
                </div>
            </div>
        `;
    }).join("");
}

function addSession() {
    clearInterval(sessionRefreshTimer);
    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>إضافة حصة</h1>
                <p>أدخل بيانات الحصة ووقت انتهائها سيحسب تلقائيًا</p>
            </div>
        </header>
        <section class="recent member-form session-form">
            <label>اسم المشترك</label>
            <input id="sessionName" type="text">
            <label>سعر الحصة</label>
            <div class="price-input">
                <input id="sessionPrice" type="number" min="1">
                <span>جنيه</span>
            </div>
            <label>تاريخ الحصة</label>
            <input id="sessionDate" type="date">
            <label>وقت بداية الحصة</label>
            <input id="sessionTime" type="time">
            <label>مدة الحصة بالدقائق</label>
            <select id="sessionDuration">
                <option value="15">15 دقيقة</option>
                <option value="20">20 دقيقة</option>
                <option value="30" selected>30 دقيقة</option>
                <option value="45">45 دقيقة</option>
                <option value="60">60 دقيقة</option>
                <option value="90">90 دقيقة</option>
                <option value="120">120 دقيقة</option>
            </select>
            <label>وقت انتهاء الحصة</label>
            <input id="sessionEndTime" type="text" readonly>
            <button type="button" id="saveSession">حفظ الحصة</button>
            <button type="button" id="cancelSession">رجوع</button>
        </section>
    `;

    const date = document.getElementById("sessionDate");
    const time = document.getElementById("sessionTime");
    const duration = document.getElementById("sessionDuration");
    const endTime = document.getElementById("sessionEndTime");
    const now = new Date();

    date.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    time.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    function calculateSessionEnd() {
        if (!date.value || !time.value) {
            endTime.value = "";
            return;
        }
        const start = createSessionDate(date.value, time.value);
        const end = new Date(start.getTime() + Number(duration.value) * 60000);
        endTime.value = formatTime(end);
    }

    date.oninput = calculateSessionEnd;
    time.oninput = calculateSessionEnd;
    duration.onchange = calculateSessionEnd;
    calculateSessionEnd();

    document.getElementById("saveSession").onclick = function() {
        const name = document.getElementById("sessionName").value.trim();
        const price = Number(document.getElementById("sessionPrice").value);

        if (!name || !price || !date.value || !time.value) {
            alert("من فضلك أكمل بيانات الحصة");
            return;
        }

        const start = createSessionDate(date.value, time.value);
        const durationMinutes = Number(duration.value);
        const end = new Date(start.getTime() + durationMinutes * 60000);

        const newSession = {
            id: Date.now(),
            name,
            price,
            date: formatDate(start),
            dateISO: start.toISOString(),
            startTime: formatTime(start),
            startISO: start.toISOString(),
            duration: durationMinutes,
            endTime: formatTime(end),
            endISO: end.toISOString()
        };

        sessions.push(newSession);
        saveToFirestore("gymTimeSessions", newSession);
        showSessions();
    };

    document.getElementById("cancelSession").onclick = () => showSessions();
}

function editSession(id) {
    clearInterval(sessionRefreshTimer);
    const session = sessions.find(s => s.id === id);
    if (!session) return;

    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>تعديل الحصة</h1>
                <p>تعديل بيانات وموعد الحصة</p>
            </div>
        </header>
        <section class="recent member-form session-form">
            <label>اسم المشترك</label>
            <input id="editSessionName" type="text" value="${session.name}">
            <label>سعر الحصة</label>
            <div class="price-input">
                <input id="editSessionPrice" type="number" min="1" value="${session.price}">
                <span>جنيه</span>
            </div>
            <label>تاريخ الحصة</label>
            <input id="editSessionDate" type="date">
            <label>وقت بداية الحصة</label>
            <input id="editSessionTime" type="time">
            <label>مدة الحصة بالدقائق</label>
            <select id="editSessionDuration">
                <option value="15">15 دقيقة</option>
                <option value="20">20 دقيقة</option>
                <option value="30">30 دقيقة</option>
                <option value="45">45 دقيقة</option>
                <option value="60">60 دقيقة</option>
                <option value="90">90 دقيقة</option>
                <option value="120">120 دقيقة</option>
            </select>
            <label>وقت انتهاء الحصة</label>
            <input id="editSessionEndTime" type="text" readonly>
            <button type="button" id="updateSession">حفظ التعديل</button>
            <button type="button" id="cancelEditSession">رجوع</button>
        </section>
    `;

    const startISO = new Date(session.startISO);
    const dateInput = document.getElementById("editSessionDate");
    const timeInput = document.getElementById("editSessionTime");
    const durationInput = document.getElementById("editSessionDuration");
    const endTimeInput = document.getElementById("editSessionEndTime");

    dateInput.value = `${startISO.getFullYear()}-${String(startISO.getMonth() + 1).padStart(2, "0")}-${String(startISO.getDate()).padStart(2, "0")}`;
    timeInput.value = `${String(startISO.getHours()).padStart(2, "0")}:${String(startISO.getMinutes()).padStart(2, "0")}`;
    durationInput.value = session.duration;

    function calculateEditSessionEnd() {
        if (!dateInput.value || !timeInput.value) {
            endTimeInput.value = "";
            return;
        }
        const start = createSessionDate(dateInput.value, timeInput.value);
        const end = new Date(start.getTime() + Number(durationInput.value) * 60000);
        endTimeInput.value = formatTime(end);
    }

    dateInput.oninput = calculateEditSessionEnd;
    timeInput.oninput = calculateEditSessionEnd;
    durationInput.onchange = calculateEditSessionEnd;
    calculateEditSessionEnd();

    document.getElementById("updateSession").onclick = function() {
        const name = document.getElementById("editSessionName").value.trim();
        const price = Number(document.getElementById("editSessionPrice").value);

        if (!name || !price) {
            alert("من فضلك أكمل البيانات");
            return;
        }

        const start = createSessionDate(dateInput.value, timeInput.value);
        const durationMinutes = Number(durationInput.value);
        const end = new Date(start.getTime() + durationMinutes * 60000);

        session.name = name;
        session.price = price;
        session.date = formatDate(start);
        session.dateISO = start.toISOString();
        session.startTime = formatTime(start);
        session.startISO = start.toISOString();
        session.duration = durationMinutes;
        session.endTime = formatTime(end);
        session.endISO = end.toISOString();

        saveToFirestore("gymTimeSessions", session);
        showSessions();
    };

    document.getElementById("cancelEditSession").onclick = () => showSessions();
}

function renewSessionItem(id) {
    clearInterval(sessionRefreshTimer);
    const session = sessions.find(s => s.id === id);
    if (!session) return;

    const price = Number(prompt("سعر الحصة الجديدة:", session.price));
    if (!price || price <= 0) return;

    const now = new Date();
    const durationMinutes = Number(session.duration || 30);
    const end = new Date(now.getTime() + durationMinutes * 60000);

    const newSession = {
        id: Date.now(),
        name: session.name,
        price,
        date: formatDate(now),
        dateISO: now.toISOString(),
        startTime: formatTime(now),
        startISO: now.toISOString(),
        duration: durationMinutes,
        endTime: formatTime(end),
        endISO: end.toISOString()
    };

    sessions.push(newSession);
    saveToFirestore("gymTimeSessions", newSession);
    showSessions();
}

async function deleteSession(id) {
    if (!confirm("هل تريد حذف هذه الحصة؟")) return;
    const session = sessions.find(s => s.id === id);
    if (!await deleteFromFirestore("gymTimeSessions", session)) return;
    sessions = sessions.filter(s => s.id !== id);
    showSessions();
}


// ==========================================
// قسم سجل المصروفات التشغيلية واليومية
// ==========================================
function showExpenses() {
    clearInterval(sessionRefreshTimer);

    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>سجل المصروفات</h1>
                <p>إدارة وتسجيل المصاريف التشغيلية (كهرباء، صيانة، مرتبات، نظافة... إلخ)</p>
            </div>
            <button id="addExpenseBtn" type="button">إضافة مصروف جديد</button>
        </header>

        <section class="recent">
            <h2>قائمة المصروفات المسجلة</h2>
            <div style="margin-bottom: 15px;">
                <input class="search" id="expenseSearch" placeholder="ابحث بعنوان المصروف أو الفئة">
            </div>
            <div id="expensesList">
                ${getExpensesHTML()}
            </div>
        </section>
    `;

    document.getElementById("addExpenseBtn").onclick = addExpenseModal;
    document.getElementById("expenseSearch").oninput = function() {
        document.getElementById("expensesList").innerHTML = getExpensesHTML(this.value);
    };
}

function getExpensesHTML(search = "") {
    const text = search.toLowerCase();
    const list = expenses.filter(e => 
        (e.title || "").toLowerCase().includes(text) || 
        (e.category || "").toLowerCase().includes(text)
    );

    if (!list.length) return `<div class="empty">لا توجد مصروفات مسجلة بعد</div>`;

    let totalExpenses = list.reduce((sum, item) => sum + Number(item.price), 0);

    return `
        <div style="margin-bottom: 12px; background:#fef2f2; border:1px solid #fecaca; padding:10px 15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#991b1b; font-weight:bold;">إجمالي المصروفات المعروضة:</span>
            <strong style="color:#991b1b; font-size:16px;">${totalExpenses} جنيه</strong>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
            ${list.map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:12px 15px; border-radius:8px; border:1px solid #e5e7eb;">
                    <div>
                        <strong style="font-size:14px; color:#1f2937;">${item.title}</strong>
                        <div style="font-size:12px; color:#6b7280; margin-top:2px;">الفئة: ${item.category} | التاريخ: ${item.date}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <strong style="color:#dc2626; font-size:15px;">- ${item.price} جنيه</strong>
                        <button onclick="deleteExpense(${item.id})" style="background:#fee2e2; color:#dc2626; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:12px;">حذف</button>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function addExpenseModal() {
    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>إضافة مصروف جديد</h1>
                <p>تسجيل قيمة وطبيعة المصروف التشغيلي</p>
            </div>
        </header>
        <section class="recent member-form">
            <label>عنوان أو وصف المصروف (مثل: فاتورة الكهرباء)</label>
            <input id="expTitle" type="text">
            
            <label>فئة المصروف</label>
            <select id="expCategory">
                <option value="كهرباء ومياه">كهرباء ومياه</option>
                <option value="صيانة أجهزة">صيانة أجهزة</option>
                <option value="مرتبات عاملين">مرتبات عاملين</option>
                <option value="أدوات نظافة وتشغيل">أدوات نظافة وتشغيل</option>
                <option value="أخرى">أخرى</option>
            </select>

            <label>قيمة المبلغ (بالجنيه)</label>
            <input id="expPrice" type="number" min="1">

            <label>تاريخ المصروف</label>
            <input id="expDate" type="date">

            <button type="button" id="saveExpense">حفظ المصروف</button>
            <button type="button" id="cancelExpense">رجوع</button>
        </section>
    `;

    const dateInput = document.getElementById("expDate");
    const now = new Date();
    dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    document.getElementById("saveExpense").onclick = function() {
        const title = document.getElementById("expTitle").value.trim();
        const category = document.getElementById("expCategory").value;
        const price = Number(document.getElementById("expPrice").value);
        const dateVal = document.getElementById("expDate").value;

        if (!title || !price || !dateVal) {
            alert("من فضلك أدخل كافة البيانات بشكل صحيح");
            return;
        }

        const [y, m, d] = dateVal.split("-");
        const formattedDate = `${d} / ${m} / ${y}`;

        const newExpense = {
            id: Date.now(),
            title,
            category,
            price,
            date: formattedDate,
            dateISO: new Date(dateVal).toISOString()
        };

        expenses.push(newExpense);
        saveToFirestore("gymExpenses", newExpense);
        showExpenses();
    };

    document.getElementById("cancelExpense").onclick = () => showExpenses();
}

async function deleteExpense(id) {
    if (!confirm("هل تريد حذف هذا المصروف؟")) return;
    const expense = expenses.find(e => e.id === id);
    if (!await deleteFromFirestore("gymExpenses", expense)) return;
    expenses = expenses.filter(e => e.id !== id);
    showExpenses();
}


// ==========================================
// قسم إدارة الإيرادات وصافي الأرباح (مقسم بالأيام)
// ==========================================
function showRevenues() {
    clearInterval(sessionRefreshTimer);

    let allTransactions = [];
    let totalSubscriptionsIncome = 0;
    let totalSessionsIncome = 0;

    members.forEach(member => {
        if (Array.isArray(member.history)) {
            member.history.forEach(item => {
                const price = Number(item.paidAmount ?? item.price) || 0;
                totalSubscriptionsIncome += price;
                allTransactions.push({
                    title: `اشتراك عضو: ${member.name}`,
                    category: item.type || "اشتراك",
                    price: price,
                    type: "income",
                    date: item.date
                });
            });
        }
    });

    sessions.forEach(session => {
        const price = Number(session.price) || 0;
        totalSessionsIncome += price;
        allTransactions.push({
            title: `حصة فردية: ${session.name}`,
            category: "حصة",
            price: price,
            type: "income",
            date: session.date
        });
    });

    expenses.forEach(exp => {
        allTransactions.push({
            title: exp.title,
            category: `مصروف (${exp.category})`,
            price: Number(exp.price) || 0,
            type: "expense",
            date: exp.date
        });
    });

    let totalIncome = totalSubscriptionsIncome + totalSessionsIncome;
    let totalExpense = allTransactions.filter(t => t.type === "expense").reduce((sum, t) => sum + t.price, 0);
    let netProfit = totalIncome - totalExpense;
    const totalOutstanding = getTotalOutstanding();
    const outstandingMembersCount = getOutstandingMembers().length;

    let groupedByDate = {};
    allTransactions.forEach(item => {
        let dateKey = item.date || "أخرى";
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(item);
    });

    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>سجل الإيرادات والأرباح مقسم بالأيام</h1>
                <p>متابعة تفصيلية للإيرادات والمصروفات وصافي الأرباح موزعة يوم بيوم</p>
            </div>
            <div>
                <button onclick="printReport()" style="background:#2563eb; color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-weight:bold;">🖨️ طباعة التقرير</button>
            </div>
        </header>

        <section class="stats" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 15px;">
            <div class="stat-card" style="background:#f8fafc; border:1px solid #e2e8f0;">
                <span style="color:#475569;">إيرادات الاشتراكات</span>
                <strong style="color:#0284c7; font-size:16px;">+ ${totalSubscriptionsIncome} جنيه</strong>
            </div>
            <div class="stat-card" style="background:#f8fafc; border:1px solid #e2e8f0;">
                <span style="color:#475569;">إيرادات الحصص</span>
                <strong style="color:#0284c7; font-size:16px;">+ ${totalSessionsIncome} جنيه</strong>
            </div>
            <div class="stat-card" style="background:#fef2f2; border:1px solid #fecaca;">
                <span style="color:#991b1b;">إجمالي المصروفات</span>
                <strong style="color:#dc2626; font-size:16px;">- ${totalExpense} جنيه</strong>
            </div>
            <div class="stat-card" style="background:#f0fdf4; border:1px solid #bbf7d0;">
                <span style="color:#166534;">صافي الأرباح الحقيقي</span>
                <strong style="color:#16a34a; font-size:18px;">${netProfit} جنيه</strong>
            </div>
            <div class="stat-card" style="background:#fff7ed; border:1px solid #fed7aa;">
                <span style="color:#9a3412;">مبالغ متبقية (${outstandingMembersCount})</span>
                <strong style="color:#ea580c; font-size:16px;">${totalOutstanding} جنيه</strong>
            </div>
        </section>

        <section class="recent">
            <h2>الحركة المالية موزعة ومجمعة حسب الأيام</h2>
            <div style="display:flex; flex-direction:column; gap:15px; margin-top:12px;">
                ${Object.keys(groupedByDate).length ? Object.keys(groupedByDate).map(date => {
                    let dayTransactions = groupedByDate[date];
                    let dayIncome = dayTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.price, 0);
                    let dayExpense = dayTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.price, 0);
                    let dayNet = dayIncome - dayExpense;

                    return `
                        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 15px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e5e7eb; padding-bottom:8px; margin-bottom:10px;">
                                <strong style="color:#1f2937; font-size:15px;">📅 تاريخ اليوم: ${date}</strong>
                                <div style="font-size:13px; display:flex; gap:10px;">
                                    <span style="color:#16a34a;">وارد: +${dayIncome} ج</span>
                                    <span style="color:#dc2626;">مصروف: -${dayExpense} ج</span>
                                    <strong style="color:${dayNet >= 0 ? '#16a34a' : '#dc2626'};">صافي اليوم: ${dayNet} ج</strong>
                                </div>
                            </div>
                            
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                ${dayTransactions.map(item => `
                                    <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:10px 12px; border-radius:6px; border:1px solid #f3f4f6;">
                                        <div>
                                            <strong style="font-size:13px; color:#374151;">${item.title}</strong>
                                            <div style="font-size:11px; color:#6b7280; margin-top:2px;">التصنيف: ${item.category}</div>
                                        </div>
                                        <div>
                                            <strong style="color: ${item.type === 'income' ? '#16a34a' : '#dc2626'}; font-size:14px;">
                                                ${item.type === 'income' ? '+' : '-'} ${item.price} جنيه
                                            </strong>
                                        </div>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                    `;
                }).join("") : `<div class="empty">لا توجد حركات مالية مسجلة بعد</div>`}
            </div>
        </section>
    `;
}


// ==========================================
// قسم التقارير الشاملة مع أزرار التصدير والطباعة
// ==========================================
function showReports() {
    clearInterval(sessionRefreshTimer);
    
    const activeMembersCount = members.filter(m => getStatusType(m) === "active").length;
    const expiringMembersCount = members.filter(m => getStatusType(m) === "expiring").length;
    const expiredMembersCount = members.filter(m => getStatusType(m) === "expired").length;

    const totalSessionsCount = sessions.length;

    let subTotalRev = 0;
    members.forEach(m => {
        if (Array.isArray(m.history)) {
            m.history.forEach(h => subTotalRev += (Number(h.paidAmount ?? h.price) || 0));
        }
    });
    let sessTotalRev = 0;
    sessions.forEach(s => sessTotalRev += (Number(s.price) || 0));
    const grandTotalRev = subTotalRev + sessTotalRev;
    const totalOutstanding = getTotalOutstanding();
    const outstandingMembersCount = getOutstandingMembers().length;

    let totalExp = expenses.reduce((sum, e) => sum + Number(e.price), 0);
    let netProfit = grandTotalRev - totalExp;

    app.innerHTML = `
        ${bannerHTML()}
        <header class="topbar">
            <div>
                <h1>التقارير الشاملة والتصدير</h1>
                <p>عرض تفصيلي وتصدير البيانات إلى ملفات إكسل (Excel) أو الطباعة المباشرة</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="exportToExcel()" style="background:#198754; color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-weight:bold;">📥 تصدير إلى Excel</button>
                <button onclick="printReport()" style="background:#2563eb; color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-weight:bold;">🖨️ طباعة التقارير</button>
            </div>
        </header>

        <section class="recent">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                
                <div style="background:#f7f8fa; padding:15px; border-radius:10px; border:1px solid #e1e5ea;">
                    <h3 style="font-size:16px; margin-bottom:12px; border-bottom:2px solid #2563eb; padding-bottom:8px; color:#2563eb;">📊 تقرير الأعضاء والحصص</h3>
                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
                        <div style="display:flex; justify-content:space-between; background:#fff; padding:8px; border-radius:6px;"><span>إجمالي الأعضاء:</span> <strong>${members.length}</strong></div>
                        <div style="display:flex; justify-content:space-between; background:#fff; padding:8px; border-radius:6px;"><span>الاشتراكات النشطة:</span> <strong style="color:#198754;">${activeMembersCount}</strong></div>
                        <div style="display:flex; justify-content:space-between; background:#fff; padding:8px; border-radius:6px;"><span>تنتهي قريبًا (غداً):</span> <strong style="color:#ffc107;">${expiringMembersCount}</strong></div>
                        <div style="display:flex; justify-content:space-between; background:#fff; padding:8px; border-radius:6px;"><span>الاشتراكات المنتهية:</span> <strong style="color:#dc3545;">${expiredMembersCount}</strong></div>
                        <div style="display:flex; justify-content:space-between; background:#fff; padding:8px; border-radius:6px;"><span>إجمالي الحصص المسجلة:</span> <strong>${totalSessionsCount}</strong></div>
                    </div>
                </div>

                <div style="background:#f7f8fa; padding:15px; border-radius:10px; border:1px solid #e1e5ea;">
                    <h3 style="font-size:16px; margin-bottom:12px; border-bottom:2px solid #198754; padding-bottom:8px; color:#198754;">💰 تقرير الأموال والأرباح الحقيقية</h3>
                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
                        <div style="display:flex; justify-content:space-between; background:#fff; padding:8px; border-radius:6px;"><span>إجمالي الإيرادات:</span> <strong>${grandTotalRev} جنيه</strong></div>
                        <div style="display:flex; justify-content:space-between; background:#fff7ed; padding:8px; border-radius:6px; border:1px solid #fed7aa;"><span>إجمالي المبالغ المتبقية (${outstandingMembersCount} مشترك):</span> <strong style="color:#ea580c;">${totalOutstanding} جنيه</strong></div>
                        <div style="display:flex; justify-content:space-between; background:#fff; padding:8px; border-radius:6px;"><span>إجمالي المصروفات:</span> <strong style="color:#dc2626;">- ${totalExp} جنيه</strong></div>
                        <div style="display:flex; justify-content:space-between; background:#e6f7eb; padding:12px; border-radius:6px; border:1px solid #198754; margin-top:5px;"><span>صافي الربح الحقيقي:</span> <strong style="color:#198754; font-size:15px;">${netProfit} جنيه</strong></div>
                    </div>
                </div>

            </div>
        </section>
    `;
}

// دالة الطباعة المباشرة
function printReport() {
    window.print();
}

// دالة تصدير بيانات المشتركين والإيرادات والمصروفات إلى ملف إكسل باستخدام مكتبة SheetJS
function exportToExcel() {
    try {
        const wb = XLSX.utils.book_new();

        const membersData = members.map(m => ({
            "رقم العضوية": m.memberNumber,
            "اسم المشترك": m.name,
            "رقم الهاتف": m.phone,
            "نوع العضوية": m.membershipType || "عادي",
            "المبلغ المدفوع": m.paidAmount ?? m.price,
            "المبلغ المتبقي": m.remainingAmount ?? 0,
            "تاريخ البداية": m.startDate,
            "تاريخ النهاية": m.endDate,
            "المدة": m.duration,
            "السعر": m.price
        }));
        const wsMembers = XLSX.utils.json_to_sheet(membersData);
        XLSX.utils.book_append_sheet(wb, wsMembers, "المشتركين");

        const expData = expenses.map(e => ({
            "عنوان المصروف": e.title,
            "الفئة": e.category,
            "القيمة": e.price,
            "التاريخ": e.date
        }));
        const wsExp = XLSX.utils.json_to_sheet(expData);
        XLSX.utils.book_append_sheet(wb, wsExp, "المصروفات");

        XLSX.writeFile(wb, "Gym_System_Report.xlsx");
    } catch (err) {
        alert("حدث خطأ أثناء تصدير الملف، تأكد من اتصال الإنترنت لتحميل مكتبة الإكسل.");
    }
}

// بدء التشغيل وجلب البيانات من Firebase فوراً
initFirebaseListeners();