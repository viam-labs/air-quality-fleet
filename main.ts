// Air quality dashboard

import * as VIAM from "@viamrobotics/sdk";
import { BSON } from "bson";

async function main() {
  const opts: VIAM.ViamClientOptions = {
    credential: {
      type: "api-key",
      // Key with location operator permissions
      // Replace <API-KEY> (including angle brackets)
      payload: "<API-KEY>",
      // Replace <API-KEY-ID> (including angle brackets)
      authEntity: "<API-KEY-ID>",
    },
  };

  const orgID: string = "<ORGANIZATION ID>"; // Replace
  const locationID: string = "<LOCATION ID>"; // Replace

  // Instantiate data_client and get all
  // data tagged with "air-quality" from your location
  const client = await VIAM.createViamClient(opts);
  const myDataClient = client.dataClient;
  const query = {
    $match: {
      tags: "air-quality",
      location_id: locationID,
      organization_id: orgID,
    },
  };
  const match = { $group: { _id: "$robot_id" } };
  // Get a list of all the IDs of machines that have collected air quality data
  const BSONQueryForMachineIDList = [
    BSON.serialize(query),
    BSON.serialize(match),
  ];
  let machineIDs: any = await myDataClient?.tabularDataByMQL(
    orgID,
    BSONQueryForMachineIDList,
  );
  // Get all the air quality data
  const BSONQueryForData = [BSON.serialize(query)];
  let thedata: any = await myDataClient?.tabularDataByMQL(
    orgID,
    BSONQueryForData,
  );

  // Instantiate the HTML block that will be returned
  // once everything is appended to it
  let htmlblock: HTMLElement = document.createElement("div");

  // Display the relevant data from each machine to the dashboard
  for (const mach of machineIDs) {
    let insideDiv: HTMLElement = document.createElement("div");
    let avgPM: number = await getLastFewAv(thedata, mach._id);
    // Color-code the dashboard based on air quality category
    let level: string = "blue";
    switch (true) {
      case avgPM < 12.1: {
        level = "good";
        break;
      }
      case avgPM < 35.5: {
        level = "moderate";
        break;
      }
      case avgPM < 55.5: {
        level = "unhealthy-sensitive";
        break;
      }
      case avgPM < 150.5: {
        level = "unhealthy";
        break;
      }
      case avgPM < 250.5: {
        level = "very-unhealthy";
        break;
      }
      case avgPM >= 250.5: {
        level = "hazardous";
        break;
      }
    }
    // Create the HTML output for this machine
    insideDiv.className = "inner-div " + level;
    insideDiv.innerHTML =
      "<p>" +
      mach._id +
      ": " +
      avgPM.toFixed(2).toString() +
      " &mu;g/m<sup>3</sup></p>";
    htmlblock.appendChild(insideDiv);
  }

  // Output a block of HTML with color-coded boxes for each machine
  return document.getElementById("insert-readings").replaceWith(htmlblock);
}

// Get the average of the last five readings from a given sensor
async function getLastFewAv(alltheData: any[], machineID: string) {
  // Get just the data from this machine
  let thedata = new Array();
  for (const entry of alltheData) {
    if (entry.robot_id == machineID) {
      thedata.push({
        PM25: entry.data.readings["pm_2.5"],
        time: entry.time_received,
      });
    }
  }

  // Sort the air quality data from this machine
  // by timestamp
  thedata = thedata.sort(function (a, b) {
    let x = a.time.toString();
    let y = b.time.toString();
    if (x < y) {
      return -1;
    }
    if (x > y) {
      return 1;
    }
    return 0;
  });

  // Add up the last 5 readings collected.
  // If there are fewer than 5 readings, add all of them.
  let x = 5; // The number of readings to average over
  if (x > thedata.length) {
    x = thedata.length;
  }
  let total = 0;
  for (let i = 1; i <= x; i++) {
    const reading: number = thedata[thedata.length - i].PM25;
    total += reading;
  }
  // Return the average of the last few readings
  return total / x;
}

main().catch((error) => {
  console.error("encountered an error:", error);
});
