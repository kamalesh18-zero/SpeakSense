import { jsPDF } from 'jspdf';
import { BenchmarkAnalysisResult } from '../types';

export function generateBenchmarkPdfReport(result: BenchmarkAnalysisResult) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Helper colors
  const primaryTeal = [20, 184, 166];
  const darkSlate = [30, 41, 59];
  const mutedSlate = [100, 116, 139];
  const lightBg = [248, 250, 252];
  const borderGray = [226, 232, 240];

  const drawHeader = (pageNumber: number, title: string) => {
    // Top banner
    doc.setFillColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.rect(0, 0, pageWidth, 12, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('SPEAKSENSE AI &bull; SPEECH ANALYTICS & TEMPORAL EVALUATION REPORT', margin, 8);

    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${pageNumber} of 4`, pageWidth - margin, 8, { align: 'right' });

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text(title, margin, 24);

    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, 28, pageWidth - margin, 28);
  };

  const drawFooter = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
    doc.text(
      'Grounded in deterministic acoustic signal processing (RMS energy, PYIN pitch, Faster-Whisper alignment). Zero simulated scores.',
      margin,
      pageHeight - 8
    );
  };

  // ==========================================
  // PAGE 1: EXECUTIVE SUMMARY & OVERALL SCORE
  // ==========================================
  drawHeader(1, 'Executive Speech Evaluation Summary');

  // Overall Score Card Box
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, 34, contentWidth, 42, 3, 3, 'F');
  doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, 34, contentWidth, 42, 3, 3, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
  const scoreText = `${Math.round(result.score.total_score)} / 100`;
  doc.text(scoreText, margin + 10, 54);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const gradeLabel =
    result.score.total_score >= 90
      ? 'Outstanding Master Delivery'
      : result.score.total_score >= 80
      ? 'Strong Professional Speech'
      : result.score.total_score >= 70
      ? 'Competent Delivery with Polish Needed'
      : 'Developing Speaker - Review Guidance Below';
  doc.setFont('helvetica', 'bold');
  doc.text(gradeLabel, margin + 10, 62);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text(`Category: ${result.category_name}`, margin + 95, 45);
  doc.text(`Duration: ${result.audio_duration_sec.toFixed(1)} seconds`, margin + 95, 52);
  doc.text(`Words Analyzed: ${result.words.length} words`, margin + 95, 59);
  doc.text(`Date: ${new Date(result.timestamp).toLocaleDateString()}`, margin + 95, 66);

  // Five Category Scores Table
  let currentY = 86;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('Category Rubric Breakdown', margin, currentY);

  currentY += 6;
  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('Evaluation Category', margin + 4, currentY + 5.5);
  doc.text('Score', margin + 65, currentY + 5.5);
  doc.text('Weight', margin + 95, currentY + 5.5);
  doc.text('Status', margin + 125, currentY + 5.5);
  doc.text('Evidence Summary', margin + 145, currentY + 5.5);

  currentY += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  result.score.categories.forEach((cat) => {
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, currentY + 8, margin + contentWidth, currentY + 8);

    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text(cat.name, margin + 4, currentY + 5.5);
    doc.text(`${cat.score.toFixed(1)} / ${cat.max_score}`, margin + 65, currentY + 5.5);
    doc.text(`${cat.weight_pct}%`, margin + 95, currentY + 5.5);
    doc.text(cat.status, margin + 125, currentY + 5.5);

    const summaryShort = cat.evidence_summary.substring(0, 32) + (cat.evidence_summary.length > 32 ? '...' : '');
    doc.text(summaryShort, margin + 145, currentY + 5.5);
    currentY += 9;
  });

  // Strengths & Key Advice
  currentY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Key Delivery Strengths', margin, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  result.strength_notes.slice(0, 3).forEach((str) => {
    doc.text(`&bull;  ${str}`, margin + 2, currentY + 4);
    currentY += 7;
  });

  currentY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Priority Improvement Focus', margin, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  result.plain_language_advice.slice(0, 3).forEach((adv) => {
    const wrapped = doc.splitTextToSize(`&bull;  ${adv}`, contentWidth - 4);
    doc.text(wrapped, margin + 2, currentY + 4);
    currentY += wrapped.length * 5 + 2;
  });

  drawFooter();

  // ==========================================
  // PAGE 2: BENCHMARK COMPARISON & BREAKDOWN
  // ==========================================
  doc.addPage();
  drawHeader(2, 'Benchmark Acoustic Comparison');

  currentY = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Acoustic Target Standards: ${result.category_name}`, margin, currentY);

  currentY += 8;
  // Comparison Table
  const tableHeaders = ['Metric Description', 'Your Measured Value', 'Benchmark Target Range', 'Variance / Assessment'];
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(tableHeaders[0], margin + 4, currentY + 5.5);
  doc.text(tableHeaders[1], margin + 55, currentY + 5.5);
  doc.text(tableHeaders[2], margin + 105, currentY + 5.5);
  doc.text(tableHeaders[3], margin + 145, currentY + 5.5);

  currentY += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const metricsRows = [
    {
      metric: 'Speaking Rate (WPM)',
      measured: `${result.measurements.effective_wpm.toFixed(1)} WPM`,
      target: `${result.target_summary.wpm_range[0]} - ${result.target_summary.wpm_range[1]} WPM`,
      status:
        result.measurements.effective_wpm < result.target_summary.wpm_range[0]
          ? 'Too Slow'
          : result.measurements.effective_wpm > result.target_summary.wpm_range[1]
          ? 'Too Fast'
          : 'Ideal Cadence',
    },
    {
      metric: 'Mean Pause Duration',
      measured: `${result.measurements.mean_pause_sec.toFixed(2)} sec`,
      target: `${result.target_summary.pause_range_sec[0]} - ${result.target_summary.pause_range_sec[1]} sec`,
      status: `${result.measurements.pause_count} pauses (${result.measurements.excessive_pause_count} excessive)`,
    },
    {
      metric: 'Pitch Expressiveness',
      measured: `${result.measurements.pitch_semitone_std.toFixed(2)} semitones`,
      target: `${result.target_summary.pitch_std_range_semitones[0]} - ${result.target_summary.pitch_std_range_semitones[1]} semitones`,
      status: result.measurements.pitch_semitone_std < 1.4 ? 'Monotonous' : 'Dynamic Pitch Range',
    },
    {
      metric: 'Dynamic Energy Range',
      measured: `${result.measurements.dynamic_range_db.toFixed(1)} dB`,
      target: `&ge; ${result.target_summary.dyn_range_min_db} dB`,
      status: result.measurements.dynamic_range_db >= 14 ? 'Expressive Projection' : 'Compressed Energy',
    },
    {
      metric: 'Clarity & SNR',
      measured: `${result.measurements.snr_db.toFixed(1)} dB SNR`,
      target: '&ge; 15.0 dB Clean SNR',
      status: `${Math.round(result.measurements.alignment_confidence * 100)}% Word Match`,
    },
  ];

  metricsRows.forEach((row) => {
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, currentY + 8, margin + contentWidth, currentY + 8);
    doc.text(row.metric, margin + 4, currentY + 5.5);
    doc.text(row.measured, margin + 55, currentY + 5.5);
    doc.text(row.target, margin + 105, currentY + 5.5);
    doc.text(row.status, margin + 145, currentY + 5.5);
    currentY += 9;
  });

  // Transcript alignment box
  currentY += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Recognized Audio Transcript', margin, currentY);

  currentY += 5;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, currentY, contentWidth, 70, 2, 2, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, currentY, contentWidth, 70, 2, 2, 'D');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const wrappedTranscript = doc.splitTextToSize(
    result.recognized_transcript || 'No transcript text available.',
    contentWidth - 8
  );
  doc.text(wrappedTranscript.slice(0, 11), margin + 4, currentY + 6);

  // Rubric formula disclosure
  currentY += 78;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Transparent Scoring Formula', margin, currentY);
  currentY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text(result.score.formula_explanation, margin, currentY + 3);

  drawFooter();

  // ==========================================
  // PAGE 3: TEMPORAL FLAWS & ACOUSTIC EVIDENCE
  // ==========================================
  doc.addPage();
  drawHeader(3, 'Temporal Flaw Finding & Evidence');

  currentY = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Identified Acoustic Deviations (${result.flaws.length} detected)`, margin, currentY);

  currentY += 8;
  if (result.flaws.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.text('No significant delivery flaws detected! Your speech closely followed target benchmarks.', margin, currentY + 6);
  } else {
    result.flaws.slice(0, 6).forEach((flaw, idx) => {
      // Flaw item box
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.roundedRect(margin, currentY, contentWidth, 26, 2, 2, 'F');
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.roundedRect(margin, currentY, contentWidth, 26, 2, 2, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text(
        `#${idx + 1} &bull; ${flaw.flaw_type.replace(/_/g, ' ').toUpperCase()} &bull; [${flaw.start_time.toFixed(1)}s - ${flaw.end_time.toFixed(1)}s]`,
        margin + 4,
        currentY + 5.5
      );

      // Severity badge
      const sevLabel = flaw.severity === 3 ? 'High Severity' : flaw.severity === 2 ? 'Moderate' : 'Mild';
      doc.setFontSize(8);
      doc.setTextColor(flaw.severity >= 2 ? 225 : 100, 29, 72);
      doc.text(sevLabel, margin + contentWidth - 25, currentY + 5.5);

      // Flaw explanation
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      const expWrapped = doc.splitTextToSize(`Evidence: ${flaw.explanation}`, contentWidth - 8);
      doc.text(expWrapped.slice(0, 2), margin + 4, currentY + 12);

      // Suggestion
      doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
      const sugWrapped = doc.splitTextToSize(`Coach Suggestion: ${flaw.improvement_suggestion}`, contentWidth - 8);
      doc.text(sugWrapped.slice(0, 2), margin + 4, currentY + 20);

      currentY += 29;
    });
  }

  drawFooter();

  // ==========================================
  // PAGE 4: PERSONALIZED ACTION PLAN
  // ==========================================
  doc.addPage();
  drawHeader(4, 'Personalized Improvement Action Plan');

  currentY = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('3-Step Daily Coaching Routine', margin, currentY);

  currentY += 8;
  const drillSteps = result.improvement_steps.length > 0 ? result.improvement_steps : [
    'Pacing Regulation Drill: Practice reading 150 words in exactly 60 seconds with a metronome.',
    'Punctuation Pause Drill: Count 1-2 internally at every period and comma before continuing.',
    'Dynamic Projection Drill: Modulate your volume and pitch intentionally between key nouns.'
  ];

  drillSteps.slice(0, 4).forEach((step, sIdx) => {
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'F');
    doc.setDrawColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryTeal[0], primaryTeal[1], primaryTeal[2]);
    doc.text(`Drill ${sIdx + 1}`, margin + 5, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    const wrappedStep = doc.splitTextToSize(step, contentWidth - 10);
    doc.text(wrappedStep, margin + 5, currentY + 13);

    currentY += 26;
  });

  // Milestone goals
  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Next Session Milestone Targets', margin, currentY);

  currentY += 6;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY, contentWidth, 34, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`1. Bring speaking pace within ${result.target_summary.wpm_range[0]} - ${result.target_summary.wpm_range[1]} WPM.`, margin + 6, currentY + 8);
  doc.text(`2. Eliminate awkward mid-phrase pauses; ensure all pauses fall on natural punctuation boundaries.`, margin + 6, currentY + 16);
  doc.text(`3. Target an overall rubric score of ${Math.min(100, Math.round(result.score.total_score) + 8)} (+8 points) on your next try.`, margin + 6, currentY + 24);

  drawFooter();

  // Trigger browser download
  const safeTitle = result.category_key || 'speech_report';
  doc.save(`SpeakSense_${safeTitle}_Analysis_Report.pdf`);
}
