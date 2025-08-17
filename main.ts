// Air quality dashboard

import * as VIAM from "@viamrobotics/sdk";
import { BSON } from "bson";
import Cookies from "js-cookie";

let access_token = "";
let fragmentID = "955d0869-65d2-4313-a7a0-966219656fdc";

async function main() {

  const opts: VIAM.ViamClientOptions = {
    serviceHost: "https://app.viam.com",
    credentials: {
      type: "access-token",
      payload: access_token,
    },
  };

  // Instantiate data_client and get all
  // data tagged with "air-quality" from your location
  const client = await VIAM.createViamClient(opts);
  const dataClient = client.dataClient;
  const locationSummaries = await client.appClient.listMachineSummaries("", [fragmentID]);

  let machineIDs: string[] = [];
  let machineNames: string[] = [];
  let measurements: any[] = [];

  // Get all the machine IDs from accessible machines that use the given fragment
  for (let locationSummary of locationSummaries) {
    let machines = locationSummary.machineSummaries;
    for (let machine of machines) {
      let machineID = machine.machineId;
      machineNames[machineID] = machine.machineName;
      machineIDs.push(machineID);
    }
  }

  const orgs = await client.appClient.listOrganizations()
  for (let machineID of machineIDs) {
    const machine = await client.appClient.getRobot(machineID);
    let locationID = machine?.location;
    let orgID = "";

    for (let org of orgs) {
      let locations = await client.appClient.listLocations(org.id);
      for (let location of locations) {
        if (location.id === locationID) {
          orgID = org.id;
          break;
        }
      }
    }

    const match_query = {
      $match: {
        tags: "air-quality",
        robot_id: machineID,
        "component_name": "PM_sensor",
        time_requested: { $gte: new Date(Date.now() - 1 * 60 * 60 * 1000) }  // Last 24 hours
      }
    }
    const group_stage = {
      $group: {
        _id: null,
        avg_pm_10: { $avg: "$data.readings.pm_10" },
        avg_pm_2_5: { $avg: "$data.readings.pm_2.5" },
        avg_pm_2_5_alt: { $avg: "$data.readings.pm_2_5" }
      }
    };

    // Get the air quality data for the current machine
    const BSONQueryForData = [BSON.serialize(match_query), BSON.serialize(group_stage)];
    try {
      let machineMeasurements: any = await dataClient?.tabularDataByMQL(
        orgID,
        BSONQueryForData,
      );
      measurements[machineID] = machineMeasurements;
    } catch (error) {
      console.error(`Error getting data for machine ${machineID}:`, error);
    }
  }

  let htmlblock: HTMLElement = document.createElement("div");

  // Display the relevant data from each machine to the dashboard
  for (let m of machineIDs) {
      let insideDiv: HTMLElement = document.createElement("div");
      let machineName = machineNames[m];

      if (!measurements[m] || measurements[m].length === 0) {
        console.log(`No measurements found for machine ${m}`);
        // Create the HTML output for this machine
        insideDiv.className = "inner-div " + "unavailable";
        insideDiv.innerHTML =
          "<p>" +
          machineName +
          ": No data";
          htmlblock.appendChild(insideDiv);

      } else {
        let avgPM: number = measurements[m][0].avg_pm_2_5_alt;
        // Color-code the dashboard based on air quality category
        let level: string = "lightgray";
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
          machineName +
          ": " +
          avgPM.toFixed(2).toString() +
          " &mu;g/m<sup>3</sup></p>";
          htmlblock.appendChild(insideDiv);
      }
  }

  // Output a block of HTML with color-coded boxes for each machine
  return document.getElementById("insert-readings")?.replaceWith(htmlblock);
}

document.addEventListener("DOMContentLoaded", async () => {

  const userTokenRawCookie = Cookies.get("userToken")!;
  const startIndex = userTokenRawCookie.indexOf("{");
  const endIndex = userTokenRawCookie.indexOf("}");
  const userTokenValue = userTokenRawCookie.slice(startIndex, endIndex+1);
  access_token = JSON.parse(userTokenValue).access_token;

  main().catch((error) => {
    console.error("encountered an error:", error);
  });
});
