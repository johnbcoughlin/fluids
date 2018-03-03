import React, {Component} from "react";
import {GPUTimer} from "../lib/gpu_timer";

type Props = {
  timer: GPUTimer,
}

type State = {
  timings: Map<string, { count: number, sum: number, sumOfSquares: number }>,
}

export class TimingComponent extends Component {
  props: Props;
  state: State = {
    timings: new Map(),
  };

  componentDidMount() {
    this.updateTimings();
  }

  render() {
    const keys = Array.from(this.state.timings.keys());
    keys.sort();
    return (
        <table>
          <tbody>
          <tr>
            <th>Key</th>
            <th>Mean time (μs)</th>
            {/*<th>Std. deviation (μs)</th>*/}
          </tr>
          {
            keys.map((k) => {
              const {count, sum, sumOfSquares} = this.state.timings.get(k);
              const expectation = count === 0 ? 0.0 : (sum / count);
              // const expectationOfSquares = count === 0 ? 0.0 : (sumOfSquares / count);
              return (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{expectation.toFixed(0)}</td>
                      {/*<td>{Math.sqrt(expectationOfSquares - expectation * expectation).toFixed(1)}</td>*/}
                    </tr>
                );
            })
          }
          </tbody>
        </table>
    );
  }

  updateTimings() {
    this.props.timer.collectResults();
    this.setState({
      timings: new Map(this.props.timer.statistics),
    });

    setTimeout(() => {
      this.updateTimings();
    }, 100);
  }
}