const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { dbAll, dbRun } = require('./db');

// Main cleanup logic
async function runCleanup() {
  console.log('Running background cleanup job...');
  try {
    // 1. Find jobs older than 24 hours that still have files associated with them
    // SQLite datetime is UTC by default
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Select jobs created > 24 hours ago that have files
    const oldJobs = await dbAll(
      `SELECT id, filepath, filename FROM jobs WHERE created_at < ? AND filepath IS NOT NULL`,
      [cutoffTime]
    );

    console.log(`Found ${oldJobs.length} expired jobs older than 24 hours.`);

    for (const job of oldJobs) {
      if (job.filepath && fs.existsSync(job.filepath)) {
        try {
          fs.unlinkSync(job.filepath);
          console.log(`Deleted expired file: ${job.filename} (${job.id})`);
        } catch (unlinkErr) {
          console.error(`Failed to delete expired file ${job.filepath}:`, unlinkErr);
        }
      }
      
      // Update DB to clear filepath and mark as done/expired
      await dbRun(
        `UPDATE jobs SET filepath = NULL, status = 'done' WHERE id = ?`,
        [job.id]
      );
    }

    // 2. Also clean up any lingering 'done' files that weren't deleted successfully at printing time
    const completedJobsWithFiles = await dbAll(
      `SELECT id, filepath, filename FROM jobs WHERE status = 'done' AND filepath IS NOT NULL`
    );

    if (completedJobsWithFiles.length > 0) {
      console.log(`Found ${completedJobsWithFiles.length} printed jobs that still have physical files.`);
      for (const job of completedJobsWithFiles) {
        if (job.filepath && fs.existsSync(job.filepath)) {
          try {
            fs.unlinkSync(job.filepath);
            console.log(`Deleted printed file: ${job.filename} (${job.id})`);
          } catch (unlinkErr) {
            console.error(`Failed to delete completed job file ${job.filepath}:`, unlinkErr);
          }
        }
        await dbRun(
          `UPDATE jobs SET filepath = NULL WHERE id = ?`,
          [job.id]
        );
      }
    }

    console.log('Cleanup job complete.');
  } catch (err) {
    console.error('Error during cleanup task:', err);
  }
}

// Schedule to run every hour
const startCleanupCron = () => {
  cron.schedule('0 * * * *', () => {
    runCleanup();
  });
  console.log('Hourly database and file cleanup cron scheduled.');
  
  // Run once on startup to clean any leftover files
  runCleanup();
};

module.exports = {
  startCleanupCron,
  runCleanup
};
