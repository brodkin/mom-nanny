class SummaryGenerator {
  generateSummary(analyzer) {
    const duration = (analyzer.endTime - analyzer.startTime) / 1000; // seconds
    
    return {
      // Top-level properties for storage service
      callSid: analyzer.callSid,
      startTime: new Date(analyzer.startTime).toISOString(),
      endTime: new Date(analyzer.endTime).toISOString(),
      
      // Call Metadata
      callMetadata: {
        callSid: analyzer.callSid,
        startTime: new Date(analyzer.startTime).toISOString(),
        endTime: new Date(analyzer.endTime).toISOString(),
        duration: duration,
        dayOfWeek: new Date(analyzer.startTime).toLocaleDateString('en-US', { weekday: 'long' }),
        timeOfDay: this.getTimeOfDay(analyzer.startTime)
      },
      
      // Conversation Metrics
      conversationMetrics: {
        totalInteractions: analyzer.interactions.length,
        userUtterances: analyzer.userUtterances.length,
        assistantResponses: analyzer.assistantResponses.length,
        interruptionCount: analyzer.interruptionCount,
        averageResponseLatency: this.calculateAverage(analyzer.responseLatencies?.map(r => r.latency) || [])
      },
      
      // Mental State Indicators
      mentalStateIndicators: {
        anxietyLevel: 0,
        agitationLevel: 0,
        overallMoodTrend: 'stable'
      },
      
      // Care Indicators
      careIndicators: {
        medicationConcerns: analyzer.medicationMentions,
        painComplaints: analyzer.painComplaints,
        hospitalRequests: analyzer.hospitalRequests,
        staffComplaints: analyzer.staffComplaints,
        sleepPatterns: this.analyzeSleepPatterns(analyzer.startTime, analyzer.interactions)
      },
      
      // Behavioral Patterns
      behavioralPatterns: {
        responseLatency: this.calculateAverage(analyzer.responseLatencies?.map(r => r.latency) || []),
        sundowningRisk: this.assessSundowningRisk(analyzer.startTime, [])
      },
      
      // Clinical Observations
      clinicalObservations: {
        hypochondriaEvents: this.countHypochondriaEvents(analyzer),
        delusionalStatements: analyzer.delusionalStatements || [],
        hallucinationIndicators: analyzer.hallucinationIndicators || [],
        paranoiaLevel: this.assessParanoiaLevel(analyzer.staffComplaints)
      },
      
      // Support Effectiveness
      supportEffectiveness: {
        engagementQuality: this.assessEngagementQuality(analyzer)
      },
      
      // Caregiver Insights
      caregiverInsights: this.generateCaregiverInsights(analyzer)
    };
  }
  
  generateCaregiverInsights(analyzer) {
    const insights = {
      currentConcerns: [],
      communicationTips: []
    };
    
    if (analyzer.medicationMentions.length > 0) {
      insights.currentConcerns.push('Mentioned medication concerns - verify with facility staff');
    }
    
    if (analyzer.interruptionCount > 2) {
      insights.communicationTips.push('Frequent interruptions - possible agitation or engagement issues');
    }
    
    return insights;
  }
  
  // Helper methods
  getTimeOfDay(timestamp) {
    const hour = new Date(timestamp).getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }
  
  calculateAverage(array) {
    if (!array || array.length === 0) return 0;
    const sum = array.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / array.length * 100) / 100;
  }
  
  calculateAnxietyLevel(moodProgression) {
    if (!moodProgression || moodProgression.length === 0) return 0;
    
    const anxietyValues = moodProgression
      .map(mood => mood.anxiety || 0)
      .filter(val => val >= 0);
    
    if (anxietyValues.length === 0) return 0;
    
    const avgAnxiety = anxietyValues.reduce((sum, val) => sum + val, 0) / anxietyValues.length;
    return Math.round(avgAnxiety * 100) / 100; // Round to 2 decimal places
  }
  
  calculateAgitationLevel(moodProgression) {
    if (!moodProgression || moodProgression.length === 0) return 0;
    
    const agitationValues = moodProgression
      .map(mood => mood.agitation || 0)
      .filter(val => val >= 0);
    
    if (agitationValues.length === 0) return 0;
    
    const avgAgitation = agitationValues.reduce((sum, val) => sum + val, 0) / agitationValues.length;
    return Math.round(avgAgitation * 100) / 100; // Round to 2 decimal places
  }
  
  assessPositiveEngagement(metrics) {
    if (!metrics || !metrics.totalResponses || metrics.totalResponses === 0) return 0;
    return Math.round((metrics.positiveResponses / metrics.totalResponses) * 100) / 100;
  }
  
  calculateMoodTrend(progression) {
    if (!progression || progression.length < 2) return 'stable';
    
    const start = progression[0];
    const end = progression[progression.length - 1];
    const diff = end - start;
    
    if (diff > 0.2) return 'improving';
    if (diff < -0.2) return 'declining';
    return 'stable';
  }
  
  analyzeSleepPatterns(startTime, interactions) {
    const hour = new Date(startTime).getHours();
    const sleepRelatedTerms = ['tired', 'sleep', 'nap', 'rest', 'sleepy', 'exhausted'];
    
    const sleepMentions = interactions.filter(interaction => 
      interaction.data && typeof interaction.data === 'string' &&
      sleepRelatedTerms.some(term => 
        interaction.data.toLowerCase().includes(term)
      )
    ).length;
    
    return {
      callTime: hour < 9 ? 'early' : hour > 20 ? 'late' : 'normal',
      sleepMentions: sleepMentions,
      potentialSleepIssues: sleepMentions > 2
    };
  }
  
  assessMemoryFunction(analyzer) {
    return 'stable';
  }
  
  assessSundowningRisk(startTime, agitationMarkers) {
    const hour = new Date(startTime).getHours();
    const agitationCount = agitationMarkers ? agitationMarkers.length : 0;
    
    // Higher risk in late afternoon/evening with agitation
    if (hour >= 16 && hour <= 20 && agitationCount > 2) {
      return 'high';
    } else if (hour >= 16 && hour <= 20 && agitationCount > 0) {
      return 'moderate';
    }
    return 'low';
  }
  
  countHypochondriaEvents(analyzer) {
    const healthWorryTerms = ['sick', 'disease', 'cancer', 'dying', 'pain', 'hurt', 'doctor', 'hospital', 'medicine'];
    let count = 0;
    
    analyzer.interactions.forEach(interaction => {
      if (interaction.type === 'user') {
        const worryCount = healthWorryTerms.filter(term => 
          interaction.content.toLowerCase().includes(term)
        ).length;
        if (worryCount > 1) count++; // Multiple health terms = hypochondria event
      }
    });
    
    return count;
  }
  
  assessParanoiaLevel(complaints) {
    if (!complaints || complaints.length === 0) return 'none';
    if (complaints.length > 3) return 'high';
    if (complaints.length > 1) return 'moderate';
    return 'low';
  }
  
  
  assessEngagementQuality(analyzer) {
    const avgLatency = this.calculateAverage(analyzer.responseLatencies?.map(r => r.latency) || []);
    
    let level = 'moderate';
    let score = 50;
    const indicators = [];
    
    if (avgLatency < 1000) {
      indicators.push('Quick responses - good engagement');
      score += 20;
    } else if (avgLatency > 3000) {
      indicators.push('Slow responses - possible disengagement');
      score -= 20;
    }
    
    if (analyzer.interruptionCount < 2) {
      indicators.push('Low interruptions - active listening');
      score += 10;
    } else {
      indicators.push('Frequent interruptions - possible agitation');
      score -= 10;
    }
    
    if (score > 70) level = 'high';
    if (score < 30) level = 'low';
    
    return {
      level: level,
      score: Math.max(0, Math.round(score)),
      indicators: indicators
    };
  }
}

module.exports = SummaryGenerator;