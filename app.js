const COURTS = ["Court 1", "Court 2", "Court 3", "Court 4"];
const TIME_SLOTS = [
  "8:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "12:00 PM - 2:00 PM",
  "2:00 PM - 4:00 PM",
  "4:00 PM - 6:00 PM",
  "6:00 PM - 8:00 PM",
  "8:00 PM - 10:00 PM",
  "10:00 PM - 11:00 PM"
];
const COURT_RATE = 20;

const page = document.body.dataset.page;

const store = {
  get(key, fallback) {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function requireUser() {
  const user = store.get("currentUser", null);
  if (!user) window.location.href = "index.html";
  return user;
}

function getCurrentMembership() {
  const user = requireUser();
  return store.get("memberships", []).find(item => item.email === user.email) || null;
}

function getMembershipStatus(membership) {
  if (!membership) return "None";
  return membership.expiryDate >= today() ? "Active" : "Expired";
}

function fillSelect(select, options) {
  select.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join("");
}

function addMonths(dateValue, months) {
  const date = new Date(dateValue);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function bookingExists(court, date, slot) {
  return store.get("bookings", []).some(booking =>
    booking.court === court &&
    booking.date === date &&
    booking.slot === slot &&
    booking.status !== "Rejected"
  );
}

function getUserBookings() {
  const user = requireUser();
  return store.get("bookings", []).filter(booking => booking.userEmail === user.email);
}

function latestUnpaidBooking() {
  return getUserBookings().reverse().find(booking => booking.paymentStatus !== "Paid") || null;
}

function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
}

function initAuthPages() {
  if (page === "login") {
    loginForm.addEventListener("submit", event => {
      event.preventDefault();
      const users = store.get("users", []);
      const user = users.find(item =>
        item.email === loginEmail.value.trim().toLowerCase() &&
        item.password === loginPassword.value
      );
      if (!user) {
        loginMessage.textContent = "Invalid email or password.";
        return;
      }
      store.set("currentUser", user);
      window.location.href = "dashboard.html";
    });
  }

  if (page === "register") {
    registerForm.addEventListener("submit", event => {
      event.preventDefault();
      const users = store.get("users", []);
      const email = registerEmail.value.trim().toLowerCase();
      if (users.some(user => user.email === email)) {
        registerMessage.textContent = "Email is already registered.";
        return;
      }
      const user = {
        name: registerName.value.trim(),
        email,
        password: registerPassword.value,
        phone: registerPhone.value.trim()
      };
      users.push(user);
      store.set("users", users);
      store.set("currentUser", user);
      window.location.href = "dashboard.html";
    });
  }
}

function initDashboard() {
  const user = requireUser();
  welcomeName.textContent = user.name || "User";
  logoutButton.addEventListener("click", logout);
}

function initMembership() {
  requireUser();
  membershipStart.value = today();
  const updateExpiry = () => {
    const months = { Monthly: 1, Quarterly: 3, Yearly: 12 }[membershipType.value];
    membershipExpiry.value = membershipStart.value ? addMonths(membershipStart.value, months) : "";
  };
  membershipType.addEventListener("change", updateExpiry);
  membershipStart.addEventListener("change", updateExpiry);
  updateExpiry();

  membershipForm.addEventListener("submit", event => {
    event.preventDefault();
    const user = requireUser();
    const memberships = store.get("memberships", []).filter(item => item.email !== user.email);
    memberships.push({
      email: user.email,
      type: membershipType.value,
      startDate: membershipStart.value,
      expiryDate: membershipExpiry.value,
      status: "Active"
    });
    store.set("memberships", memberships);
    membershipMessage.textContent = "Membership application saved.";
  });
}

function initBooking() {
  requireUser();
  fillSelect(bookingCourt, COURTS);
  fillSelect(bookingSlot, TIME_SLOTS);
  bookingDate.value = today();
  const membership = getCurrentMembership();
  memberStatus.textContent = getMembershipStatus(membership);
  memberType.textContent = membership ? membership.type : "None";

  bookingForm.addEventListener("submit", event => {
    event.preventDefault();
    if (bookingExists(bookingCourt.value, bookingDate.value, bookingSlot.value)) {
      bookingMessage.textContent = "Selected court and time slot is already booked.";
      return;
    }
    const user = requireUser();
    const bookings = store.get("bookings", []);
    const id = String(bookings.length + 1).padStart(3, "0");
    bookings.push({
      id,
      userEmail: user.email,
      court: bookingCourt.value,
      date: bookingDate.value,
      slot: bookingSlot.value,
      status: "Pending",
      paymentStatus: "Pending",
      amount: bookingSlot.value.includes("10:00 PM") ? COURT_RATE : COURT_RATE * 2
    });
    store.set("bookings", bookings);
    store.set("pendingPaymentId", id);
    window.location.href = "history.html";
  });
}

function initPayment() {
  requireUser();
  const pendingId = store.get("pendingPaymentId", "");
  const bookings = store.get("bookings", []);
  const booking = bookings.find(item => item.id === pendingId) || latestUnpaidBooking();
  paymentDate.value = today();

  if (!booking) {
    paymentMessage.textContent = "No pending booking found.";
    paymentForm.querySelectorAll("input, select, button").forEach(item => item.disabled = true);
    return;
  }

  paymentBookingId.value = booking.id;
  paymentAmount.value = booking.amount.toFixed(2);
  paymentStatus.textContent = booking.paymentStatus;

  paymentForm.addEventListener("submit", event => {
    event.preventDefault();
    booking.paymentStatus = "Paid";
    const payments = store.get("payments", []);
    payments.push({
      bookingId: booking.id,
      method: paymentMethod.value,
      amount: booking.amount,
      date: paymentDate.value,
      status: "Paid",
      transactionId: `TXN-${Date.now()}`
    });
    store.set("bookings", bookings);
    store.set("payments", payments);
    localStorage.removeItem("pendingPaymentId");
    paymentMessage.textContent = "Payment confirmed.";
    paymentStatus.textContent = "Paid";
  });

  cancelPayment.addEventListener("click", () => {
    localStorage.removeItem("pendingPaymentId");
    window.location.href = "dashboard.html";
  });
}

function renderAvailability() {
  const court = availabilityCourt.value;
  const date = availabilityDate.value;
  availabilityRows.innerHTML = TIME_SLOTS.map(slot => {
    const status = bookingExists(court, date, slot) ? "Booked" : "Available";
    return `<tr><td>${slot}</td><td>${status}</td></tr>`;
  }).join("");
}

function initAvailability() {
  requireUser();
  fillSelect(availabilityCourt, COURTS);
  availabilityDate.value = today();
  availabilityForm.addEventListener("submit", event => {
    event.preventDefault();
    renderAvailability();
  });
  renderAvailability();
}

function initHistory() {
  const bookings = getUserBookings();
  if (!bookings.length) {
    historyEmpty.textContent = "No bookings yet.";
    return;
  }
  historyRows.innerHTML = bookings.map(booking => `
    <tr>
      <td>${booking.id}</td>
      <td>${booking.court}</td>
      <td>${booking.date}</td>
      <td>${booking.slot}</td>
      <td>${booking.status}</td>
      <td>${booking.paymentStatus}</td>
    </tr>
  `).join("");
}

initAuthPages();
if (page === "dashboard") initDashboard();
if (page === "membership") initMembership();
if (page === "booking") initBooking();
if (page === "payment") initPayment();
if (page === "availability") initAvailability();
if (page === "history") initHistory();
