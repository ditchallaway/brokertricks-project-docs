/**
 * Sequential render queue
 * Ensures only one job processes at a time to prevent WebGL memory starvation
 */
class RenderQueue {
    constructor() {
        this.queue = Promise.resolve();
        this.activeJob = null;
        this.jobCount = 0;
        this.currentProgress = 0;
        this.currentStatus = 'Idle';
    }

    /**
     * Enqueue a render job
     * @param {Function} jobFn - Async function that performs the render. 
     *                           Receives an updateProgress(percent, status) callback.
     * @returns {Promise} Resolves with job result
     */
    async enqueue(jobFn) {
        const jobId = ++this.jobCount;
        
        return new Promise((resolve, reject) => {
            this.queue = this.queue.then(async () => {
                this.activeJob = jobId;
                this.currentProgress = 0;
                this.currentStatus = 'Started';
                console.log(`[Queue] Job #${jobId} started`);
                
                const updateProgress = (percent, status) => {
                    this.currentProgress = Math.round(percent);
                    this.currentStatus = status;
                };

                try {
                    const result = await jobFn(updateProgress);
                    console.log(`[Queue] Job #${jobId} completed`);
                    resolve(result);
                } catch (err) {
                    console.error(`[Queue] Job #${jobId} failed:`, err.message);
                    reject(err);
                } finally {
                    this.activeJob = null;
                    this.currentProgress = 0;
                    this.currentStatus = 'Idle';
                }
            }).catch(reject);
        });
    }

    /**
     * Get current queue status, which provides visibility into the worker's state
     */
    getStatus() {
        return {
            // ID of the job currently being processed by the worker queue
            activeJob: this.activeJob,
            // Total number of jobs that have been submitted to the queue
            totalJobs: this.jobCount,
            // Boolean indicating if the worker queue is currently busy
            queued: this.activeJob !== null,
            // Real-time progress percentage of the active job
            progress: this.currentProgress,
            // Current status message from the renderer
            status: this.currentStatus
        };
    }
}

module.exports = RenderQueue;
