const L_ACCELERATION_CONST = 0.8;
const G_ACCELERATION_CONST = 0.8;

const stepCtr = document.getElementById("step") as HTMLHeadingElement;
const bestText = document.getElementById("best") as HTMLParagraphElement;
const targetText = document.getElementById("target") as HTMLParagraphElement;
const costText = document.getElementById("cost") as HTMLParagraphElement;

const graph = document.getElementById("graph") as HTMLCanvasElement;
const sim = document.getElementById("sim") as HTMLCanvasElement;
const graphCtx = graph.getContext("2d");
const simCtx = sim.getContext("2d");

const GRAPH_WIDTH = graph.width = 900;
const GRAPH_HEIGHT = graph.height = 900;
const WIDTH = sim.width = 900;
const HEIGHT = sim.height = 900;

function rand(factor: number)
{
    return Math.random() * factor;
}

function rgb(r: number, g: number, b: number): string
{
    return "rgb(" + r + ", " + g + ", " + b + ")";
}

// Round to two decimal places
function twoplaces(x: number): number
{
    return Math.round(x * 100) / 100;
}

function arrayMax(array: Array<number>): number
{
    var max = Number.MIN_VALUE;
    for (let x of array) {
        if (max < x) {
            max = x;
        }
    }

    return max;
}

function arrayMin(array: Array<number>): number
{
    var min = Number.MAX_VALUE;
    for (let x of array) {
        if (min > x) {
            min = x;
        }
    }

    return min;
}

class Point
{
    x: number;
    y: number;

    constructor(x: number, y: number)
    {
        this.x = x;
        this.y = y;
    }
}

class Quadratic
{
    coefficients: Array<number>;

    constructor(a: number, b: number, c: number)
    {
        this.coefficients = [a, b, c];
    }

    a() { return this.coefficients[0]; }
    b() { return this.coefficients[1]; }
    c() { return this.coefficients[2]; }

    valueAt(x: number): number
    {
        return this.a() * Math.pow(x, 2) + this.b() * x + this.c(); 
    }

    copy(): Quadratic
    {
        return new Quadratic(this.a(), this.b(), this.c());
    }

    toString(): string
    {
        return (
            twoplaces(this.a()) + "x^2 + " +
            twoplaces(this.b()) + "x + " +
            twoplaces(this.c())
        );
    }
}

class Particle
{
    value: Quadratic;
    velocity: Quadratic;
    lBest: Quadratic;
    lBestCost: number;

    constructor(factor: number)
    {
        this.value = new Quadratic(rand(factor), rand(factor), rand(factor));
        this.velocity = new Quadratic(0, 0, 0);
        this.lBest = null;
        this.lBestCost = Number.MAX_VALUE;
    }
    
    updateLBest(dataset: Array<Point>): void
    {
        var cost = 0;
        for (let point of dataset) {
            let pred = this.value.valueAt(point.x);
            cost += Math.pow(pred - point.y, 2);
        }
        cost = Math.sqrt(cost);
        
        if (this.lBest === null || cost < this.lBestCost) {
            this.lBest = this.value.copy();
            this.lBestCost = cost;
        }
    }
}

class Swarm
{
    coefFactor: number

    target: Quadratic;
    dataset: Array<Point>;
    particles: Array<Particle>;
    gBest = null;
    gBestCost = Number.MAX_VALUE;

    step = 0;

    constructor(factor: number, n_datapoints: number, scale: number, noiseFactor: number, n_particles: number)
    {
        this.coefFactor = factor;
        this.target = new Quadratic(rand(factor), rand(factor), rand(factor));
        targetText.innerText = "Target: " + this.target.toString();

        this.dataset = new Array(n_datapoints);
        for (let i = 0; i < n_datapoints; i++) {
            let x = rand(scale);
            let noise = rand(2 * noiseFactor) - noiseFactor;
            let y = this.target.valueAt(x) + noise;
            this.dataset[i] = new Point(x, y);
        }

        this.particles = new Array(n_particles);
        for (let i = 0; i < n_particles; i++) {
            this.particles[i] = new Particle(factor);
        }
    }

    private updateSwarm(): Swarm
    {
        for (let particle of this.particles) {
            particle.updateLBest(this.dataset);
            
            if (this.gBest === null || particle.lBestCost < this.gBestCost) {
                this.gBest = particle.lBest.copy();
                this.gBestCost = particle.lBestCost;
            }
        }

        for (let i = 0; i < 3; i++) {
            let r1 = Math.random();
            let r2 = Math.random();
            for (let particle of this.particles) {
                let value = particle.value.coefficients[i];
                let diffLBest = particle.lBest.coefficients[i] - value;
                let diffGBest = this.gBest.coefficients[i] - value;
                particle.velocity.coefficients[i] += (
                    L_ACCELERATION_CONST * r1 * diffLBest +
                    G_ACCELERATION_CONST * r2 * diffGBest
                ) * 0.001;

                particle.value.coefficients[i] += particle.velocity.coefficients[i];
            }
        }

        return this;
    }

    private renderGraph(): Swarm
    {
        // Clear
        graphCtx.fillStyle = "black";
        graphCtx.fillRect(0, 0, GRAPH_WIDTH, GRAPH_HEIGHT);

        // Border
        simCtx.strokeStyle = "white 2px";
        simCtx.strokeRect(0, 0, GRAPH_WIDTH, GRAPH_HEIGHT);

        var xs = this.dataset.map(point => point.x);
        var ys = this.dataset.map(point => point.y);
        var x_lower = arrayMin(xs);
        var x_upper = arrayMax(xs);
        var y_lower = arrayMin(ys);
        var y_upper = arrayMax(ys);

        // Display each datapoint in the dataset and each corresponding gBest prediction
        for (let point of this.dataset) {
            graphCtx.fillStyle = "white";
            graphCtx.beginPath();
            graphCtx.arc(
                (point.x - x_lower) / (x_upper - x_lower) * WIDTH,
                HEIGHT - (point.y - y_lower) / (y_upper - y_lower) * HEIGHT,
                8,
                0,
                Math.PI * 2,
            );
            graphCtx.fill();

            graphCtx.fillStyle = "green";
            graphCtx.beginPath();
            graphCtx.arc(
                (point.x - x_lower) / (x_upper - x_lower) * WIDTH,
                HEIGHT - (this.gBest.valueAt(point.x) - y_lower) / (y_upper - y_lower) * HEIGHT,
                6,
                0,
                Math.PI * 2,
            );
            graphCtx.fill();
        }

        return this;
    }

    private scale(value: number): number
    {
        return value / (2 * this.coefFactor) + 1/4;
    }

    private renderSwarm(): Swarm
    {
        // Clear
        simCtx.fillStyle = "black";
        simCtx.fillRect(0, 0, WIDTH, HEIGHT);

        // Border
        simCtx.strokeStyle = "white";
        simCtx.lineWidth = 2;
        simCtx.strokeRect(0, 0, WIDTH, HEIGHT);

        

        // Display each particle
        for (let particle of this.particles) {
            let scaled_c = this.scale(particle.value.c()) * 255;
            simCtx.fillStyle = rgb(255, scaled_c, 255);
            simCtx.beginPath();
            simCtx.arc(
                this.scale(particle.value.a()) * WIDTH,
                (1 - this.scale(particle.value.b())) * HEIGHT,
                5,
                0,
                Math.PI * 2,
            );
            simCtx.fill();
        }

        // Display a point for the target
        let scaled_c = this.scale(this.target.c()) * 255;
        simCtx.fillStyle = rgb(255, scaled_c, 255);
        simCtx.beginPath();
        simCtx.arc(
            this.scale(this.target.a()) * WIDTH,
            (1 - this.scale(this.target.b())) * HEIGHT,
            12,
            0,
            Math.PI * 2,
        );
        simCtx.fill();

        simCtx.strokeStyle = rgb(255, 0, 0);
        simCtx.lineWidth = 3;
        simCtx.stroke();

        return this;
    }

    // Main program loop
    fullUpdate(): void
    {
        this.updateSwarm();
        this.renderGraph().renderSwarm();
        this.step++;

        stepCtr.innerText = "Step #" + this.step;
        bestText.innerText = "Best: " + this.gBest.toString();
        costText.innerText = "Cost: " + twoplaces(this.gBestCost);
    }
}

function getInitState(): Swarm
{
    return new Swarm(100, 200, 1e5, 8e10, 500);
}

// Initial program state
var swarm = getInitState();
setInterval(() => swarm.fullUpdate(), 20);

const reset = document.getElementById("reset") as HTMLButtonElement;
reset.onclick = () => {
    swarm = getInitState();
}
