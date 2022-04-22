const L_ACCELERATION_CONST = 0.5;
const G_ACCELERATION_CONST = 0.5;

const graph = document.getElementById("graph") as HTMLCanvasElement;
const sim = document.getElementById("sim") as HTMLCanvasElement;
const graphCtx = graph.getContext("2d");
const simCtx = sim.getContext("2d");

const GRAPH_WIDTH = graph.width = 500;
const GRAPH_HEIGHT = graph.height = 500;
const WIDTH = sim.width = 400;
const HEIGHT = sim.height = 400;

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
    target: Quadratic;
    dataset: Array<Point>;
    particles: Array<Particle>;
    gBest: Quadratic;
    gBestCost: number;

    constructor(factor: number, n_datapoints: number, scale: number, noiseFactor: number, n_particles: number)
    {
        this.target = new Quadratic(rand(factor), rand(factor), rand(factor));
        this.dataset = new Array(n_datapoints);
        for (let i = 0; i < n_datapoints; i++) {
            let x = rand(2 * scale) - scale; // Produces a number in the range (-scale, scale)
            let y = this.target.valueAt(x) + rand(2 * noiseFactor) - noiseFactor;
            this.dataset[i] = new Point(x, y);
        }

        this.particles = new Array(n_particles);
        for (let i = 0; i < n_particles; i++) {
            this.particles[i] = new Particle(factor);
        }

        this.gBest = null;
        this.gBestCost = Number.MAX_VALUE;
    }

    updateSwarm(): Swarm
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

    // For testing
    colorVal = 0;
    renderGraph(): Swarm
    {
        graphCtx.fillStyle = rgb(this.colorVal, this.colorVal, this.colorVal);

        graphCtx.fillRect(0, 0, GRAPH_WIDTH, GRAPH_HEIGHT);
        this.colorVal += 1;
        this.colorVal %= 255;

        return this;
    }

    renderSwarm(): Swarm
    {
        simCtx.fillStyle = "black";
        simCtx.fillRect(0, 0, WIDTH, HEIGHT);

        return this;
    }
}

// Initial program state
const swarm = new Swarm(10, 1000, 100, 10, 200);

// Main program loop.
// Updates the swarm, renders the new state, and then waits.
function update() {
    swarm.updateSwarm().renderGraph().renderSwarm();
}

setInterval(update, 10);
