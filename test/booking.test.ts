import axios, { AxiosError } from "axios";
import { startServer, stopServer } from "../source/server";
import { PrismaClient } from "@prisma/client";

const GUEST_A_UNIT_1 = {
  unitID: "1",
  guestName: "GuestA",
  checkInDate: new Date().toISOString().split("T")[0],
  numberOfNights: 5,
};

const GUEST_A_UNIT_2 = {
  unitID: "2",
  guestName: "GuestA",
  checkInDate: new Date().toISOString().split("T")[0],
  numberOfNights: 5,
};

const GUEST_B_UNIT_1 = {
  unitID: "1",
  guestName: "GuestB",
  checkInDate: new Date().toISOString().split("T")[0],
  numberOfNights: 5,
};

const prisma = new PrismaClient();

beforeEach(async () => {
  // Clear any test setup or state before each test
  await prisma.booking.deleteMany();
});

beforeAll(async () => {
  await startServer();
});

afterAll(async () => {
  await prisma.$disconnect();
  await stopServer();
});

describe("Booking API", () => {
  test("Create fresh booking", async () => {
    const response = await axios.post(
      "http://localhost:8000/api/v1/booking",
      GUEST_A_UNIT_1
    );

    expect(response.status).toBe(200);
    expect(response.data.guestName).toBe(GUEST_A_UNIT_1.guestName);
    expect(response.data.unitID).toBe(GUEST_A_UNIT_1.unitID);
    expect(response.data.numberOfNights).toBe(GUEST_A_UNIT_1.numberOfNights);
  });

  test("Same guest same unit booking", async () => {
    // Create first booking
    const response1 = await axios.post(
      "http://localhost:8000/api/v1/booking",
      GUEST_A_UNIT_1
    );
    expect(response1.status).toBe(200);
    expect(response1.data.guestName).toBe(GUEST_A_UNIT_1.guestName);
    expect(response1.data.unitID).toBe(GUEST_A_UNIT_1.unitID);

    // Guests want to book the same unit again
    let error: any;
    try {
      await axios.post("http://localhost:8000/api/v1/booking", GUEST_A_UNIT_1);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(AxiosError);
    expect(error.response.status).toBe(400);
    expect(error.response.data).toEqual(
      "The given guest name cannot book the same unit multiple times"
    );
  });

  test("Same guest different unit booking", async () => {
    // Create first booking
    const response1 = await axios.post(
      "http://localhost:8000/api/v1/booking",
      GUEST_A_UNIT_1
    );
    expect(response1.status).toBe(200);
    expect(response1.data.guestName).toBe(GUEST_A_UNIT_1.guestName);
    expect(response1.data.unitID).toBe(GUEST_A_UNIT_1.unitID);

    // Guest wants to book another unit
    let error: any;
    try {
      await axios.post("http://localhost:8000/api/v1/booking", GUEST_A_UNIT_2);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(AxiosError);
    expect(error.response.status).toBe(400);
    expect(error.response.data).toEqual(
      "The same guest cannot be in multiple units at the same time"
    );
  });

  test("Different guest same unit booking", async () => {
    // Create first booking
    const response1 = await axios.post(
      "http://localhost:8000/api/v1/booking",
      GUEST_A_UNIT_1
    );
    expect(response1.status).toBe(200);
    expect(response1.data.guestName).toBe(GUEST_A_UNIT_1.guestName);
    expect(response1.data.unitID).toBe(GUEST_A_UNIT_1.unitID);

    // GuestB trying to book a unit that is already occupied
    let error: any;
    try {
      await axios.post("http://localhost:8000/api/v1/booking", GUEST_B_UNIT_1);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(AxiosError);
    expect(error.response.status).toBe(400);
    expect(error.response.data).toEqual(
      "For the given check-in date, the unit is already occupied"
    );
  });

  test("Different guest same unit booking different date", async () => {
    // Create first booking
    const response1 = await axios.post(
      "http://localhost:8000/api/v1/booking",
      GUEST_A_UNIT_1
    );
    expect(response1.status).toBe(200);
    expect(response1.data.guestName).toBe(GUEST_A_UNIT_1.guestName);

    // GuestB trying to book a unit that is already occupied
    let error: any;
    try {
      const response2 = await axios.post(
        "http://localhost:8000/api/v1/booking",
        {
          unitID: "1",
          guestName: "GuestB",
          checkInDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          numberOfNights: 5,
        }
      );
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(AxiosError); // it will give 400 status as GuestB is trying to book same unit
    expect(error.response.status).toBe(400);
    // expect(response2.status).toBe(400);
    // expect(response2.data.detail).toBe(
    //   "For the given check-in date, the unit is already occupied"
    // );
    // expect(response2.status).toBe(400);
    expect(error.response.data).toBe(
      "For the given check-in date, the unit is already occupied"
    );
  });
});
