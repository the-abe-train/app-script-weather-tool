function pullForecasts() {

  // Active google sheet
  const tab = getTab()

  // Clear existing data
  tab.getRange(2, 3, tab.getLastRow() - 1, tab.getLastColumn() - 2).clearContent()

  // Pull list of cities from GSheet
  const cities = importCities(tab);

  // Get map of cities to city codes from government
  const cityMap = cityCodes();

  // Map our cities to their codes
  const citiesWithCodes = cities.map(city => {
    return {
      ...city,
      ...cityMap[city['province']][city['name']]
    }
  })

  // Get temp data for each city from government
  const temperatures = citiesWithCodes.map(city => {
    let temps
    try {
      temps = getHighs(city)
    } catch (error) {
      temps = {}
    }
    return {
      ...city,
      temps
    }
  })

  // Print dates as headers in table
  printTable(tab, temperatures)

  console.log(temperatures)

}


function cityCodes() {
  const url = "https://collaboration.cmc.ec.gc.ca/cmc/cmos/public_doc/msc-data/citypage-weather/site_list_en.geojson"
  const response = UrlFetchApp.fetch(url);
  const text = response.getContentText();
  const jsonData = JSON.parse(text);
  const data = jsonData['features']
  const cityMap = data.reduce((obj, value) => {
    const city = value['properties']['English Names']
    const code = value['properties']['Codes']
    const province = value['properties']['Province Codes']
    if (!(province in obj)) {
      obj[province] = {};
    }
    obj[province][city] = {
      code
    }
    return obj
  }, {})
  return cityMap
}


function getHighs({ province, code }) {
  const url = `https://dd.weather.gc.ca/citypage_weather/xml/${province}/${code}_e.xml`;
  const response = UrlFetchApp.fetch(url);
  const xml = response.getContentText();
  const document = XmlService.parse(xml);
  const root = document.getRootElement();
  const forecastGroup = root.getChild('forecastGroup')
  const forecasts = forecastGroup.getChildren().filter(item => {
    const name = item.getName();
    return name == 'forecast'
  })
  const daytimeForecasts = forecasts.filter(forecast => {
    const period = forecast.getChild('period').getValue();
    return period.indexOf('night') == -1
  })
  const highs = daytimeForecasts.reduce((obj, forecast) => {
    const day = forecast.getChild('period').getValue();
    const temp = forecast.getChild('temperatures').getChild('temperature').getValue();
    obj[day] = temp;
    return obj
  }, {})
  const newHighs = dayToDate(highs)
  return newHighs
}





function dayToDate(dataByDay) {

  // Weekday map
  const weekDayMap = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday'
  }

  // Make map of days of week to dates starting today
  const dateMap = {}
  for (let j = 0; j < 7; j++) {
    const day = new Date();
    day.setDate(new Date().getDate() + j)
    const weekDay = weekDayMap[day.getDay()];
    const date = day.toISOString().split('T')[0]
    dateMap[weekDay] = date
  }

  const result = {};
  for (let weekDay in dataByDay) {
    const date = dateMap[weekDay]
    result[date] = dataByDay[weekDay]
  }



  return result

}

function getTab() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const tab = sheet.getSheetByName('Weather Tool');
  const rng = tab.getRange('A1:E5');
  const data = rng.getValues();
  return tab
}

function importCities(tab) {
  const lastRow = tab.getLastRow();
  const rawData = tab.getRange(3, 1, lastRow, 2).getValues();

  const cities = rawData.filter(row => row[0].length > 0).map((row) => {
    return {
      province: row[0],
      name: row[1]
    }
  })

  return cities
}


function printTable(tab, data) {

  const temps = data.map(city => city['temps']);

  // Get largest array of dates
  // in case not all cities produced weather data for the same date range
  const dates = data
    .map(city => Object.keys(city['temps']))
    .sort((a, b) => a.length < b.length)
  const mostDates = dates[0];

  // Print dates to header of table
  const headers = tab.getRange(2, 3, 1, mostDates.length);
  headers.setValues(Array(mostDates));


  // Create one object of all temp and date data
  const tempData = mostDates.reduce((obj, val) => {
    obj[val] = []
    for (let city of temps) {
      obj[val].push(city[val])
    }
    return obj
  }, {})

  // Print data to tab, starting at column 3
  let col = 3;
  for (let date of mostDates) {
    const printRows = tempData[date];
    const printCol = printRows.map(row => Array(row));  // Arrange rows as a column
    const printRng = tab.getRange(3, col, printCol.length, 1)
    printRng.setValues(printCol)
    col++;
  }




}






















