const L_ACCELERATION_CONST = 0.3;
const G_ACCELERATION_CONST = 0.3;

const stepCtr = document.getElementById("step") as HTMLHeadingElement;
const graph = document.getElementById("graph") as HTMLCanvasElement;
const sim = document.getElementById("sim") as HTMLCanvasElement;
const graphCtx = graph.getContext("2d");
const simCtx = sim.getContext("2d");

const GRAPH_WIDTH = graph.width = 1000;
const GRAPH_HEIGHT = graph.height = 1000;
const WIDTH = sim.width = 1000;
const HEIGHT = sim.height = 1000;

function rand(factor: number)
{
    return Math.random() * factor;
}

function rgb(r: number, g: number, b: number): string
{
    return "rgb(" + r + ", " + g + ", " + b + ")";
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

        if (this.lBest === null || cost < this.lBestCost) {
            this.lBest = this.value.copy();
            this.lBestCost = cost;
        }
    }
}

class Swarm
{
    coefFactor: number
    x_scale: number;
    y_scale: number;

    target: Quadratic;
    dataset: Array<Point>;
    particles: Array<Particle>;
    gBest = null;
    gBestCost = Number.MAX_VALUE;

    step = 0;

    constructor(factor: number, n_datapoints: number, scale: number, noiseFactor: number, n_particles: number)
    {
        this.coefFactor = factor;
        this.x_scale = scale;

        this.target = new Quadratic(rand(factor), rand(factor), rand(factor));
        this.y_scale = this.target.valueAt(scale); // Max value

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
                );

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

        // Display each datapoint in the dataset and each corresponding gBest prediction
        for (let point of this.dataset) {
            graphCtx.fillStyle = "white";
            graphCtx.beginPath();
            graphCtx.arc(
                point.x / this.x_scale * WIDTH,
                point.y / this.y_scale * HEIGHT,
                8,
                0,
                Math.PI * 2,
            );
            graphCtx.fill();

            graphCtx.fillStyle = "green";
            graphCtx.beginPath();
            graphCtx.arc(
                point.x / this.x_scale * WIDTH,
                this.gBest.valueAt(point.x) / this.y_scale * HEIGHT,
                6,
                0,
                Math.PI * 2,
            );
            graphCtx.fill();
        }

        return this;
    }

    private renderSwarm(): Swarm
    {
        // Clear
        simCtx.fillStyle = "black";
        simCtx.fillRect(0, 0, WIDTH, HEIGHT);

        // Border
        simCtx.strokeStyle = "white 2px";
        simCtx.strokeRect(0, 0, WIDTH, HEIGHT);

        // Display each particle
        for (let particle of this.particles) {
            simCtx.fillStyle = rgb(0, 255, particle.value.c() / this.coefFactor * 255);
            simCtx.beginPath();
            simCtx.arc(
                particle.value.a() / this.coefFactor * WIDTH,
                particle.value.b() / this.coefFactor * HEIGHT,
                5,
                0,
                Math.PI * 2,
            );
            simCtx.fill();
        }

        // Display a point for the target
        simCtx.fillStyle = rgb(this.target.c() / this.coefFactor * 255, 255, 0);
        simCtx.beginPath();
        simCtx.arc(
            this.target.a() / this.coefFactor * WIDTH,
            this.target.b() / this.coefFactor * HEIGHT,
            8,
            0,
            Math.PI * 2,
        );
        simCtx.fill();

        return this;
    }

    // Main program loop
    fullUpdate(): void
    {
        this.updateSwarm();
        this.renderGraph().renderSwarm();
        this.step++;

        stepCtr.innerText = "Step #" + this.step;
    }
}

function getInitState(): Swarm
{
    return new Swarm(200, 12, 10, 350, 10);
}

// Initial program state
var swarm = getInitState();
setInterval(() => swarm.fullUpdate(), 1000);

const reset = document.getElementById("reset") as HTMLButtonElement;
reset.onclick = () => {
    swarm = getInitState();
}
