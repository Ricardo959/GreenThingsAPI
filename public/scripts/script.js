let ctx = document.getElementById('myChart').getContext('2d');

let chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ["10:11","10:12","10:13","10:14","10:15","10:16","10:17","10:18","10:19","10:20"],
        datasets: [{
            data: [86,114,106,106,107,111,133,221,783,2478],
            label: "Humidity",
            borderColor: "#e8c3b9",
            fill: false
        }, {
            data: [282,350,411,502,635,809,947,1402,3700,5267],
            label: "Temperature",
            borderColor: "#c45850",
            fill: false
        }, {
            data: [168,170,178,190,203,276,408,547,675,734],
            label: "Precipitation",
            borderColor: "#3e95cd",
            fill: false
        }, {
            data: [40,20,10,16,24,38,74,167,508,784],
            label: "Luminosity",
            borderColor: "#8e5ea2",
            fill: false
        }, {
            data: [6,3,2,2,7,26,82,172,312,433],
            label: "Ground Humidity",
            borderColor: "#3cba9f",
            fill: false
        }
        ]
    },
    options: {
        gridLines: {
            color: "white"
        },
        scales: {
            yAxes: [{
                ticks: {
                    fontColor: "white"
                },
            }],
            xAxes: [{
                ticks: {
                    fontColor: "white"
                },
            }]
        },
        title: {
            display: true,
            fontColor: 'white',
            text: 'Device: 11:22:33:44:55:66'
        },
        legend: {
            labels: {
                fontColor: 'white'
            }
        }
    }
});