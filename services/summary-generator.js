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
        repetitionCount: analyzer.repetitions.size,
        topicsDiscussed: Array.from(analyzer.topics.keys()),
        successfulRedirections: analyzer.successfulRedirections.length,
        interruptionCount: analyzer.interruptionCount,
        averageResponseLatency: this.calculateAverage(analyzer.responseLatencies)
      },
      
      // Mental State Indicators
      mentalStateIndicators: {
        moodProgression: analyzer.moodProgression,
        anxietyLevel: this.calculateAnxietyLevel(analyzer.moodProgression),
        confusionIndicators: analyzer.confusionIndicators,
        agitationLevel: this.calculateAgitationLevel(analyzer.moodProgression),
        positiveEngagement: this.assessPositiveEngagement(analyzer.engagementMetrics),
        overallMoodTrend: this.calculateMoodTrend(analyzer.moodProgression)
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
        responseLatency: this.calculateAverage(analyzer.responseLatencies),
        coherenceLevel: this.calculateAverage(analyzer.coherenceScores),
        memoryIndicators: this.assessMemoryFunction(analyzer),
        sundowningRisk: this.assessSundowningRisk(analyzer.startTime, analyzer.agitationMarkers)
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
        comfortingSuccess: analyzer.successfulRedirections,
        triggerTopics: this.identifyTriggers(analyzer),
        calmingStrategies: this.identifyCalmingStrategies(analyzer),
        engagementQuality: this.assessEngagementQuality(analyzer)
      },
      
      // Caregiver Insights
      caregiverInsights: this.generateCaregiverInsights(analyzer)
    };
  }
  
  generateCaregiverInsights(analyzer) {
    const insights = {
      recommendedConversationStarters: [],
      topicsToAvoid: [],
      optimalCallTimes: [],
      currentConcerns: [],
      positiveStrategies: [],
      communicationTips: []
    };
    
    // Analyze successful topics
    const successfulTopics = Array.from(analyzer.topics.entries())
      .filter(([, data]) => data.sentiment > 0.5)
      .map(([topic]) => topic);
    
    insights.recommendedConversationStarters = successfulTopics.slice(0, 3).map(topic => 
      `Ask about ${topic} - she responded positively to this topic`
    );
    
    // Identify triggers to avoid
    const triggers = Array.from(analyzer.topics.entries())
      .filter(([, data]) => data.sentiment < -0.3)
      .map(([topic]) => topic);
    
    insights.topicsToAvoid = triggers.map(topic => 
      `Avoid discussing ${topic} - increased anxiety/agitation`
    );
    
    // Time-based recommendations
    if (analyzer.startTime) {
      const hour = new Date(analyzer.startTime).getHours();
      if (hour >= 16 && analyzer.agitationMarkers.length > 2) {
        insights.currentConcerns.push('Possible sundowning - consider earlier call times');
        insights.optimalCallTimes.push('Morning or early afternoon calls recommended');
      }
    }
    
    // Communication strategies that worked
    if (analyzer.successfulRedirections.length > 0) {
      insights.positiveStrategies = analyzer.successfulRedirections.slice(0, 3).map(r => 
        `"${r.strategy}" successfully redirected from ${r.fromTopic} to ${r.toTopic}`
      );
    }
    
    // Specific tips based on patterns
    if (analyzer.repetitions.size > 5) {
      insights.communicationTips.push('High repetition today - remain patient and redirect gently');
    }
    
    if (analyzer.confusionIndicators > 3) {
      insights.communicationTips.push('Showing confusion - use simple, clear language and avoid complex topics');
    }
    
    if (analyzer.medicationMentions.length > 0) {
      insights.currentConcerns.push('Mentioned medication concerns - verify with facility staff');
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
    const memoryScore = {
      repetitionLevel: analyzer.repetitions.size,
      coherenceScore: this.calculateAverage(analyzer.coherenceScores),
      confusionLevel: analyzer.confusionIndicators
    };
    
    // Simple assessment based on patterns
    if (memoryScore.repetitionLevel > 5 && memoryScore.confusionLevel > 3) {
      return 'concerning';
    } else if (memoryScore.repetitionLevel > 3 || memoryScore.confusionLevel > 2) {
      return 'moderate';
    }
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
  
  identifyTriggers(analyzer) {
    return Array.from(analyzer.topics.entries())
      .filter(([, data]) => data.sentiment < -0.3)
      .map(([topic, data]) => ({
        topic: topic,
        sentiment: data.sentiment,
        frequency: data.count
      }))
      .sort((a, b) => a.sentiment - b.sentiment) // Most negative first
      .slice(0, 5);
  }
  
  identifyCalmingStrategies(analyzer) {
    // Identify what worked based on successful redirections
    const strategies = analyzer.successfulRedirections.map(redirect => ({
      strategy: redirect.strategy,
      effectiveness: 'high',
      context: `Redirected from ${redirect.fromTopic} to ${redirect.toTopic}`
    }));
    
    // Add topic-based strategies
    const positiveTopics = Array.from(analyzer.topics.entries())
      .filter(([, data]) => data.sentiment > 0.6)
      .map(([topic, data]) => ({
        strategy: `Discuss ${topic}`,
        effectiveness: 'high',
        context: `Consistently positive responses (sentiment: ${data.sentiment})`
      }));
    
    return [...strategies, ...positiveTopics].slice(0, 5);
  }
  
  assessEngagementQuality(analyzer) {
    if (!analyzer.engagementMetrics) {
      return {
        level: 'unknown',
        score: 0,
        indicators: []
      };
    }
    
    const positiveRatio = analyzer.engagementMetrics.positiveResponses / analyzer.engagementMetrics.totalResponses;
    const avgLatency = this.calculateAverage(analyzer.responseLatencies);
    
    let level = 'low';
    let score = positiveRatio * 100;
    const indicators = [];
    
    if (positiveRatio > 0.7) {
      level = 'high';
      indicators.push('High positive response rate');
    } else if (positiveRatio > 0.5) {
      level = 'moderate';
    }
    
    if (avgLatency < 1000) {
      indicators.push('Quick responses - good engagement');
    } else if (avgLatency > 3000) {
      indicators.push('Slow responses - possible disengagement');
      score -= 20;
    }
    
    if (analyzer.interruptionCount < 2) {
      indicators.push('Low interruptions - active listening');
    } else {
      indicators.push('Frequent interruptions - possible agitation');
      score -= 10;
    }
    
    return {
      level: level,
      score: Math.max(0, Math.round(score)),
      indicators: indicators
    };
  }
}

module.exports = SummaryGenerator;