import { Request, Response, NextFunction } from "express";
import axis, { AxiosResponse } from "axios";
import { Database } from "sqlite3";
import { PrismaClient, Prisma } from "@prisma/client";
import prisma from "../prisma";

interface Booking {
  guestName: string;
  unitID: string;
  checkInDate: Date;
  numberOfNights: number;
  id?: number;
}

const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
  return res.status(200).json({
    message: "OK",
  });
};

const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let booking: Booking = req.body;

  let outcome = await isBookingPossible(booking);
  console.log(outcome, "outcome");
  if (!outcome.result) {
    return res.status(400).json(outcome.reason);
  }

  const bookingResult = await prisma.booking.create({
    data: {
      guestName: booking.guestName,
      unitID: booking.unitID,
      checkInDate: new Date(booking.checkInDate),
      numberOfNights: booking.numberOfNights,
    },
  });

  return res.status(200).json(bookingResult);
};

type bookingOutcome = { result: boolean; reason: string };

async function isBookingPossible(booking: Booking): Promise<bookingOutcome> {
  // check 1 : The Same guest cannot book the same unit multiple times
  let sameGuestSameUnit = await prisma.booking.findMany({
    where: {
      AND: {
        guestName: {
          equals: booking.guestName,
        },
        unitID: {
          equals: booking.unitID,
        },
      },
    },
  });
  if (sameGuestSameUnit.length > 0) {
    return {
      result: false,
      reason: "The given guest name cannot book the same unit multiple times",
    };
  }

  // check 2 : the same guest cannot be in multiple units at the same time
  let sameGuestAlreadyBooked = await prisma.booking.findMany({
    where: {
      guestName: {
        equals: booking.guestName,
      },
    },
  });
  if (sameGuestAlreadyBooked.length > 0) {
    return {
      result: false,
      reason: "The same guest cannot be in multiple units at the same time",
    };
  }

  // check 3 : Unit is available for the check-in date
  let isUnitAvailableOnCheckInDate = await prisma.booking.findMany({
    // AND doesnt work here, because, if bookig is already done on 30.10.2023, and guest B is trying to book on 31.10.2023, but he will find no records with checkInDate 31.10.2023 and unitId: 1
    where: {
      AND: {
        // checkInDate: {
        //   equals: new Date(booking.checkInDate),
        // },
        unitID: {
          equals: booking.unitID,
        },
      },
    },
  });

  if (isUnitAvailableOnCheckInDate?.length) {
    // add numberOfNights to checkInDate
    const extendedDateByAddingNumberOfNights =
      isUnitAvailableOnCheckInDate[0]?.checkInDate.setDate(
        isUnitAvailableOnCheckInDate[0]?.checkInDate.getDate() +
          booking.numberOfNights
      );

    // if checkInDate is less than new extended date that means unit is already booked.
    if (
      new Date(booking.checkInDate).getTime() <
      new Date(extendedDateByAddingNumberOfNights).getTime()
    ) {
      return {
        result: false,
        reason: "For the given check-in date, the unit is already occupied",
      };
    }
  }

  // if (isUnitAvailableOnCheckInDate.length > 0) {
  //   return {
  //     result: false,
  //     reason: "For the given check-in date, the unit is already occupied",
  //   };
  // }

  return { result: true, reason: "OK" };
}

const extendBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { unitID, guestName, extendedNumberOfNights } = req.body;

  let isEntered = true;
  if (unitID === "") isEntered = false;
  else if (guestName === "") isEntered = false;
  else if (extendedNumberOfNights === "") isEntered = false;

  if (!isEntered) {
    res.status(400).json({ message: "Please enter all the inputs" });
    return;
  }

  // check if booking is available in database
  const existingBooking = await prisma.booking.findFirst({
    where: {
      unitID,
      guestName,
    },
  });

  if (!existingBooking) {
    res
      .status(400)
      .json({ message: `Sorry, Booking not found for this unitId: ${unitID}` });
  } else {
    // check if unit is available for next days,
    // find checkout date by adding extendedNumberOfNights into checkinDate
    const checkOuDate = new Date(
      existingBooking.checkInDate.setDate(
        existingBooking.checkInDate.getDate() + Number(extendedNumberOfNights)
      )
    ).getTime();

    const where = {
      AND: {
        unitID: {
          equals: unitID,
        },
        checkInDate: {
          equals: new Date(checkOuDate).toISOString(),
        },
        numberOfNights: {
          equals: Number(extendedNumberOfNights),
        },
      },
    };
    // check if unit is available for next days or it is occupied by someone else
    const unitAvailable = await checkUnit(where);

    if (unitAvailable?.length > 0) {
      res.status(400).json({ message: "Sorry, no unit available!" });
    } else {
      const booking: Booking = {
        id: existingBooking.id,
        unitID: existingBooking.unitID,
        numberOfNights: extendedNumberOfNights,
        checkInDate: new Date(checkOuDate),
        guestName,
      };

      try {
        await updateBookingInDB(booking);

        res.status(200).json({
          message:
            "Congratulations! your Extension request is approved. Enjoy your stay",
        });
      } catch (err) {
        console.log("Something went wrong while updating data", err);
        res
          .status(400)
          .json({ message: "Something went wrong while updating data" });
      }
    }
  }
};

const checkUnit = async (where: any): Promise<Booking[]> => {
  return await prisma.booking.findMany({ where });
};

const updateBookingInDB = async (booking: Booking) => {
  const { id, unitID, numberOfNights, checkInDate, guestName } = booking;
  await prisma.booking.update({
    where: { id },
    data: {
      unitID: unitID,
      numberOfNights: Number(numberOfNights),
      checkInDate: new Date(checkInDate).toISOString(),
      guestName,
    },
  });
};

export default { healthCheck, createBooking, extendBooking };
