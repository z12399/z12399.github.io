(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.COURSE_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MODEL_VERSION = 'course-timeline-v2';

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function findCatalogCourse(catalog, courseId) {
    const wanted = numeric(courseId);
    if (wanted == null) return null;
    for (const track of catalog?.racetracks || []) {
      const course = (track.courses || []).find(item => Number(item.id) === wanted);
      if (course) return { ...course, trackId: numeric(track.id) };
    }
    return null;
  }

  function hasGeometry(course) {
    return Boolean(
      course
      && numeric(course.length)
      && Array.isArray(course.phases)
      && course.phases.length >= 3
      && Array.isArray(course.straights)
      && Array.isArray(course.corners)
    );
  }

  function courseIdFromRace(race) {
    return numeric(
      race?.courseId
      ?? race?.course?.courseId
      ?? race?.course?.id
    );
  }

  function normalizeRanges(items, kind, extra = () => ({})) {
    return (items || [])
      .map((item, index) => ({
        kind,
        index,
        start: numeric(item.start),
        end: numeric(item.end),
        ...extra(item)
      }))
      .filter(item => item.start != null && item.end != null && item.end > item.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);
  }

  function buildTimeline(course, context = {}) {
    if (!hasGeometry(course)) {
      const distance = numeric(course?.length ?? context.course_distance);
      return {
        modelVersion: MODEL_VERSION,
        courseId: numeric(course?.id),
        trackId: numeric(course?.trackId ?? context.track_id),
        distance,
        terminalStart: distance == null ? null : Math.round(distance * 2 / 3),
        finalPhaseStart: distance == null ? null : Math.round(distance * 5 / 6),
        positionKeepEnd: numeric(course?.positionKeepEnd),
        phases: [],
        straights: [],
        corners: [],
        slopes: [],
        geometryConfidence: 'unknown',
        warnings: ['缺少確切 courseId 或完整賽道幾何；技能馬身只能顯示粗略估算。']
      };
    }

    const distance = numeric(course.length);
    const phases = normalizeRanges(course.phases, 'phase', item => ({
      phase: numeric(item.id)
    }));
    const terminalPhase = phases.find(item => item.phase === 2);
    const finalPhase = phases.find(item => item.phase === 3);
    const straights = normalizeRanges(course.straights, 'straight', item => ({
      frontType: numeric(item.frontType)
    }));
    const corners = normalizeRanges(course.corners, 'corner', item => ({
      cornerNumber: numeric(item.number)
    }));
    const slopes = normalizeRanges(course.slopes, 'slope', item => ({
      slope: numeric(item.slope),
      direction: Number(item.slope) > 0 ? 'up' : Number(item.slope) < 0 ? 'down' : 'flat'
    }));
    const terminalStart = numeric(course?.spurtStart?.meters)
      ?? terminalPhase?.start
      ?? Math.round(distance * 2 / 3);
    const finalPhaseStart = finalPhase?.start ?? Math.round(distance * 5 / 6);
    const terminalSegment = [
      ...straights.map(item => ({ ...item, label: '直線' })),
      ...corners.map(item => ({ ...item, label: `第 ${item.cornerNumber || '?'} 彎道` }))
    ].find(item => terminalStart >= item.start && terminalStart < item.end);
    const terminalSlopes = slopes.filter(item =>
      terminalStart >= item.start && terminalStart < item.end
    );

    return {
      modelVersion: MODEL_VERSION,
      courseId: numeric(course.id),
      trackId: numeric(course.trackId ?? context.track_id),
      distance,
      terminalStart,
      finalPhaseStart,
      positionKeepEnd: numeric(course.positionKeepEnd),
      phases,
      straights,
      corners,
      slopes,
      terminalSegment: terminalSegment || null,
      terminalSlopes,
      geometryConfidence: 'catalog',
      warnings: []
    };
  }

  function resolveCourse(catalog, raceOrContext = {}) {
    const courseId = courseIdFromRace(raceOrContext);
    const embedded = raceOrContext?.course;
    const catalogCourse = findCatalogCourse(catalog, courseId);
    const course = hasGeometry(catalogCourse)
      ? catalogCourse
      : hasGeometry(embedded)
        ? embedded
        : catalogCourse || embedded || null;
    const context = {
      ...(raceOrContext?.context || {}),
      always: 1,
      course_distance: numeric(
        raceOrContext?.distance
        ?? raceOrContext?.distanceMeters
        ?? course?.length
        ?? raceOrContext?.context?.course_distance
      ) ?? raceOrContext?.context?.course_distance,
      track_id: numeric(
        raceOrContext?.trackId
        ?? course?.trackId
        ?? raceOrContext?.context?.track_id
      ) ?? raceOrContext?.context?.track_id
    };
    const timeline = buildTimeline(course, context);
    return {
      course,
      context,
      timeline,
      courseId: courseId ?? timeline.courseId,
      geometryConfidence: timeline.geometryConfidence,
      warnings: timeline.warnings
    };
  }

  function geometryAt(timeline, meters) {
    const point = Number(meters);
    if (!Number.isFinite(point)) return null;
    const phase = (timeline?.phases || []).find(item => point >= item.start && point < item.end);
    const straight = (timeline?.straights || []).find(item => point >= item.start && point < item.end);
    const corner = (timeline?.corners || []).find(item => point >= item.start && point < item.end);
    const slope = (timeline?.slopes || []).find(item => point >= item.start && point < item.end);
    return { phase: phase || null, straight: straight || null, corner: corner || null, slope: slope || null };
  }

  return {
    MODEL_VERSION,
    findCatalogCourse,
    hasGeometry,
    buildTimeline,
    resolveCourse,
    geometryAt
  };
});
