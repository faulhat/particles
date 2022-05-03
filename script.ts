const stepCtr = document.getElementById("step") as HTMLHeadingElement;
const bestText = document.getElementById("best") as HTMLParagraphElement;
const targetText = document.getElementById("target") as HTMLParagraphElement;
const costText = document.getElementById("cost") as HTMLParagraphElement;
const r2Text = document.getElementById("r2") as HTMLParagraphElement;

const graph = document.getElementById("graph") as HTMLCanvasElement;
const sim = document.getElementById("sim") as HTMLCanvasElement;
const graphCtx = graph.getContext("2d");
const simCtx = sim.getContext("2d");

const GRAPH_WIDTH = graph.width = 900;
const GRAPH_HEIGHT = graph.height = 900;
const WIDTH = sim.width = 900;
const HEIGHT = sim.height = 900;

// Get a number in range [0, factor)
function rand(factor: number)
{
    return Math.random() * factor;
}

// Get an int in range [min, max)
function randInt(min: number, max: number)
{
    return Math.floor(rand(max - min) + min);
}

// Get a number in range (-factor, factor)
function randSigned(factor: number)
{
    if (Math.random() < 0.5) {
        return -rand(factor);
    }

    return rand(factor);
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

function arrayMax(array: number[]): number
{
    var max = Number.MIN_VALUE;
    for (let x of array) {
        if (max < x) {
            max = x;
        }
    }

    return max;
}

function arrayMin(array: number[]): number
{
    var min = Number.MAX_VALUE;
    for (let x of array) {
        if (min > x) {
            min = x;
        }
    }

    return min;
}

function getBaseErr(dataset: Point[]): number
{
    let sum = dataset.reduce((a, b) => a + b.y, 0);
    let avg = sum / dataset.length;
    
    return dataset.reduce((a, b) => a + Math.pow(avg - b.y, 2), 0);
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

class Polynomial
{
    readonly coefficients: number[];
    readonly n_coefs: number;

    constructor(a: number, b: number, remaining: number[])
    {
        this.coefficients = [a, b, ...remaining];
        this.n_coefs = this.coefficients.length;
    }

    getRemaining()
    {
        return this.coefficients.slice(2);
    }

    static random(n_coefs: number, factor: number): Polynomial
    {
        let a = randSigned(factor);
        let b = randSigned(factor);

        let n_remaining = n_coefs - 2;
        let remaining = new Array(n_remaining);
        for (let i = 0; i < n_remaining; i++) {
            remaining[i] = randSigned(factor);
        }

        return new Polynomial(a, b, remaining);
    }

    static zero(n_coefs: number): Polynomial
    {
        let remaining = new Array(n_coefs - 2);
        for (let i = 0; i < n_coefs - 2; i++) remaining[i] = 0;

        return new Polynomial(0, 0, remaining);
    }

    a() { return this.coefficients[0]; }
    b() { return this.coefficients[1]; }

    valueAt(x: number): number
    {
        let y = 0;
        for (let i = 0; i < this.n_coefs; i++) {
            y += this.coefficients[i] * Math.pow(x, this.n_coefs - 1 - i);
        }

        return y;
    }

    copy(): Polynomial
    {
        return new Polynomial(this.coefficients[0], this.coefficients[1], this.coefficients.slice(2));
    }

    toString(): string
    {
        let out = "y = " + twoplaces(this.coefficients[0]) + "x^" + (this.n_coefs - 1);
        for (let i = 1; i < this.n_coefs; i++) {
            if (this.coefficients[i] == 0) {
                continue;
            }
            else if (this.coefficients[i] < 0) {
                out += " - " + twoplaces(Math.abs(this.coefficients[i]));
            }
            else {
                out += " + " + twoplaces(this.coefficients[i]);
            }

            if (i < this.n_coefs - 2) {
                out += "x^" + (this.n_coefs - 1 - i);
            }
            else if (i == this.n_coefs - 2) {
                out += "x";
            }
        }

        return out;
    }
}

class Particle
{
    static readonly n_coefs = 4;

    factor: number;
    value: Polynomial;
    velocity: Polynomial;
    lBest: Polynomial;
    lBestCost: number;
    color: string;

    constructor(factor: number)
    {
        this.factor = factor;
        this.value = Polynomial.random(Particle.n_coefs, factor);
        this.velocity = Polynomial.random(Particle.n_coefs, factor * 0.1);
        this.lBest = null;
        this.lBestCost = Number.MAX_VALUE;
        this.color = rgb(
            randInt(50, 250),
            randInt(50, 250),
            randInt(50, 250),
        );
    }

    private scale(value: number): number
    {
        return value / (12 * this.factor) + 1/2;
    }

    getPosition(width: number, height: number): Point
    {
        let x = this.scale(this.value.a()) * width;
        let y = (1 - this.scale(this.value.b())) * height;
        return new Point(x, y);
    }
    
    updateLBest(dataset: Point[]): void
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
    readonly n_steps: number;

    coefFactor: number
    readonly target: Particle;
    dataset: Point[];
    particles: Particle[];
    gBest = null;
    gBestCost = Number.MAX_VALUE;

    readonly baseErr: number;
    rsquared = 0;

    static readonly CYCLE = 16;
    substep = 0;
    step = 0;

    constructor(factor: number, n_datapoints: number, scale: number, noiseFactor: number, n_particles: number, n_steps: number)
    {
        this.coefFactor = factor;
        this.target = new Particle(factor);
        targetText.innerText = "Target: " + this.target.value.toString();

        this.dataset = new Array(n_datapoints);
        for (let i = 0; i < n_datapoints; i++) {
            let x = randSigned(scale);
            let noise = randSigned(noiseFactor);
            let y = this.target.value.valueAt(x) + noise;
            this.dataset[i] = new Point(x, y);
        }
        this.baseErr = getBaseErr(this.dataset);

        this.particles = new Array(n_particles);
        for (let i = 0; i < n_particles; i++) {
            this.particles[i] = new Particle(5 * factor);
            this.particles[i].factor = factor;
        }

        this.n_steps = n_steps;
    }

    private getInertiaCoef(): number
    {
        return this.step/this.n_steps * (0.4 - 0.8) + 0.8;
    }

    private getAccelerationCoefLocal(): number
    {
        return this.step/this.n_steps * (0.5 - 2.5) + 2.5;
    }

    private getAccelerationCoefGlobal(): number
    {
        return 3 - this.getAccelerationCoefLocal();
    }

    private updateVelocities(): void
    {
        for (let particle of this.particles) {
            particle.updateLBest(this.dataset);
            
            if (this.gBest === null || particle.lBestCost < this.gBestCost) {
                this.gBest = particle.lBest.copy();
                this.gBestCost = particle.lBestCost;
            }
        }
        this.rsquared = 1 - (Math.pow(this.gBestCost, 2) / this.baseErr);

        for (let particle of this.particles) {
            for (let i = 0; i < Particle.n_coefs; i++) {
                let r1 = Math.random();
                let r2 = Math.random();

                let value = particle.value.coefficients[i];
                let diffLBest = particle.lBest.coefficients[i] - value;
                let diffGBest = this.gBest.coefficients[i] - value;
                particle.velocity.coefficients[i] = (
                    this.getInertiaCoef() * particle.velocity.coefficients[i] +
                    this.getAccelerationCoefLocal() * r1 * diffLBest +
                    this.getAccelerationCoefGlobal() * r2 * diffGBest
                );
            }
        }
    }

    private doSubstep(): Swarm
    {
        if (this.substep == 0) {
            this.step++;
            this.updateVelocities();
        }
        this.substep = (this.substep + 1) % Swarm.CYCLE;

        for (let particle of this.particles) {
            for (let i = 0; i < Particle.n_coefs; i++) {
                particle.value.coefficients[i] += particle.velocity.coefficients[i] * 1/Swarm.CYCLE;
            }
        }

        return this;
    }

    private renderGraph(ctx: CanvasRenderingContext2D): Swarm
    {
        let { width, height } = ctx.canvas.getBoundingClientRect();

        // Clear
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        // Border
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, width, height);

        var xs = this.dataset.map(point => point.x);
        var ys = this.dataset.map(point => point.y);
        var x_lower = arrayMin(xs);
        var x_upper = arrayMax(xs);
        var y_lower = arrayMin(ys);
        var y_upper = arrayMax(ys);

        // Display each datapoint in the dataset and each corresponding gBest prediction
        for (let point of this.dataset) {
            ctx.fillStyle = "red";
            ctx.beginPath();
            ctx.arc(
                (point.x - x_lower) / (x_upper - x_lower) * width,
                (1 - (point.y - y_lower) / (y_upper - y_lower)) * height,
                10,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }

        for (let x = x_lower; x < x_upper; x += (x_upper - x_lower) / 1000) {
            ctx.fillStyle = "blue";
            ctx.beginPath();
            ctx.arc(
                (x - x_lower) / (x_upper - x_lower) * width,
                (1 - (this.gBest.valueAt(x) - y_lower) / (y_upper - y_lower)) * height,
                4,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }

        return this;
    }

    private renderSwarm(ctx: CanvasRenderingContext2D): Swarm
    {
        let { width, height } = ctx.canvas.getBoundingClientRect();

        // Clear
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        // Border
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, ctx.canvas.width, height);

        // Display a point for the target
        let position = this.target.getPosition(width, height);
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(
            position.x,
            position.y,
            15,
            0,
            Math.PI * 2,
        );
        ctx.fill();

        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Display each particle
        for (let particle of this.particles) {
            let position = particle.getPosition(width, height);
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(
                position.x,
                position.y,
                10,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }

        return this;
    }

    // Main program loop
    fullUpdate(graphCtx: CanvasRenderingContext2D, simCtx: CanvasRenderingContext2D): boolean
    {
        if (this.step >= this.n_steps) return true;

        this.doSubstep().renderGraph(graphCtx).renderSwarm(simCtx);
        return false;
    }
}

const nDataInput = document.getElementById("n_data") as HTMLInputElement;
const nParticlesInput = document.getElementById("n_particles") as HTMLInputElement;
const nStepsInput = document.getElementById("n_steps") as HTMLInputElement;

function getInitState(): Swarm
{
    const FACTOR = 50;
    const SCALE = 10;
    const NOISE_FACTOR = 5000;

    let n_data = parseInt(nDataInput.value);
    if (isNaN(n_data) || n_data < 2) {
        n_data = 50;
    }

    let n_particles = parseInt(nParticlesInput.value);
    if (isNaN(n_particles) || n_particles < 1) {
        n_particles = 100;
    }

    let n_steps = parseInt(nStepsInput.value);
    if (isNaN(n_steps) || n_steps < 1) {
        n_steps = 50;
    }
    
    return new Swarm(FACTOR, n_data, SCALE, NOISE_FACTOR, n_particles, n_steps);
}

// Initial program state
var swarm = getInitState();
setInterval(() => {
    if (swarm.fullUpdate(graphCtx, simCtx)) return;

    stepCtr.innerText = "Step: " + swarm.step + "/" + swarm.n_steps;
    bestText.innerText = "Best: " + swarm.gBest.toString();
    costText.innerText = "Cost: " + twoplaces(swarm.gBestCost);
    r2Text.innerText = "R-squared: " + twoplaces(swarm.rsquared);
}, 25);

const reset = document.getElementById("reset") as HTMLButtonElement;
reset.onclick = () => {
    swarm = getInitState();
};
