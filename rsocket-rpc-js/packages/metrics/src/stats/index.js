/**
 * @fileOverview Stats package
 *
 * @requires ExponentiallyWeightedMovingAverage
 * @requires ExponentiallyDecayingSample
 * @requires Sample
 * @requires ISample
 * @requires UniformSample
 * @exports EWMA
 * @exports ExponentiallyDecayingSample
 * @exports ISample
 * @exports Sample
 * @exports UniformSample
 */
import EWMA from './ExponentiallyWeightedMovingAverage';
import ExponentiallyDecayingSample from './ExponentiallyDecayingSample';
import Sample from './Sample';
import ISample from './ISample';
import UniformSample from './UniformSample';

export {EWMA, ExponentiallyDecayingSample, ISample, Sample, UniformSample};
